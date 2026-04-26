from datetime import datetime, timezone
from app import db
import uuid


def gen_uuid():
    return str(uuid.uuid4())


# ─── Tenant & Auth ────────────────────────────────────────────────────────────

class Tenant(db.Model):
    __tablename__ = "tenants"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)  # subdomain
    plan = db.Column(db.String(50), default="free")  # free, starter, pro
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    users = db.relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    ingredients = db.relationship("Ingredient", back_populates="tenant", cascade="all, delete-orphan")
    recipes = db.relationship("Recipe", back_populates="tenant", cascade="all, delete-orphan")
    batches = db.relationship("Batch", back_populates="tenant", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "plan": self.plan,
            "created_at": self.created_at.isoformat(),
        }


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey("tenants.id"), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(200))
    role = db.Column(db.String(50), default="maker")  # owner, admin, maker
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    tenant = db.relationship("Tenant", back_populates="users")

    __table_args__ = (db.UniqueConstraint("tenant_id", "email"),)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
        }


# ─── Ingredients & Lots ───────────────────────────────────────────────────────

class Ingredient(db.Model):
    __tablename__ = "ingredients"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey("tenants.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    inci_name = db.Column(db.String(200))           # INCI/CTFA name for labels
    category = db.Column(db.String(100))            # oil, butter, lye, fragrance, additive, etc.
    unit = db.Column(db.String(20), default="g")    # g, ml, oz, lb
    cost_per_unit = db.Column(db.Numeric(10, 4))    # default cost
    supplier = db.Column(db.String(200))
    cas_number = db.Column(db.String(50))
    sap_value_naoh = db.Column(db.Numeric(8, 6))    # for lye calculator (NaOH SAP)
    sap_value_koh = db.Column(db.Numeric(8, 6))     # for lye calculator (KOH SAP)
    max_usage_pct = db.Column(db.Numeric(5, 2))     # IFRA / safe usage limit
    notes = db.Column(db.Text)
    safety_notes = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    tenant = db.relationship("Tenant", back_populates="ingredients")
    lots = db.relationship("IngredientLot", back_populates="ingredient", cascade="all, delete-orphan")

    def to_dict(self, include_stock=False):
        d = {
            "id": self.id,
            "name": self.name,
            "inci_name": self.inci_name,
            "category": self.category,
            "unit": self.unit,
            "cost_per_unit": float(self.cost_per_unit) if self.cost_per_unit else None,
            "supplier": self.supplier,
            "cas_number": self.cas_number,
            "sap_value_naoh": float(self.sap_value_naoh) if self.sap_value_naoh else None,
            "sap_value_koh": float(self.sap_value_koh) if self.sap_value_koh else None,
            "max_usage_pct": float(self.max_usage_pct) if self.max_usage_pct else None,
            "notes": self.notes,
            "safety_notes": self.safety_notes,
            "is_active": self.is_active,
        }
        if include_stock:
            d["stock_on_hand"] = self.stock_on_hand
        return d

    @property
    def stock_on_hand(self):
        """Derived from inventory ledger — never stored directly."""
        result = db.session.query(
            db.func.coalesce(db.func.sum(InventoryTransaction.quantity_delta), 0)
        ).filter(InventoryTransaction.ingredient_id == self.id).scalar()
        return float(result)


class IngredientLot(db.Model):
    __tablename__ = "ingredient_lots"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    ingredient_id = db.Column(db.String(36), db.ForeignKey("ingredients.id"), nullable=False)
    lot_number = db.Column(db.String(100))
    supplier_lot = db.Column(db.String(100))
    purchased_at = db.Column(db.DateTime)
    expiry_date = db.Column(db.DateTime)
    quantity_received = db.Column(db.Numeric(12, 4))
    cost_per_unit = db.Column(db.Numeric(10, 4))   # overrides ingredient default
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    ingredient = db.relationship("Ingredient", back_populates="lots")

    def to_dict(self):
        return {
            "id": self.id,
            "ingredient_id": self.ingredient_id,
            "lot_number": self.lot_number,
            "supplier_lot": self.supplier_lot,
            "purchased_at": self.purchased_at.isoformat() if self.purchased_at else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "quantity_received": float(self.quantity_received) if self.quantity_received else None,
            "cost_per_unit": float(self.cost_per_unit) if self.cost_per_unit else None,
        }


# ─── Recipes ──────────────────────────────────────────────────────────────────

class Recipe(db.Model):
    __tablename__ = "recipes"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey("tenants.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100))            # soap, lotion, lip_balm, candle, etc.
    description = db.Column(db.Text)
    yield_amount = db.Column(db.Numeric(10, 4))     # base batch yield
    yield_unit = db.Column(db.String(20), default="g")
    yield_count = db.Column(db.Integer)             # number of units (bars, tubes, etc.)
    version = db.Column(db.Integer, default=1)
    is_archived = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tenant = db.relationship("Tenant", back_populates="recipes")
    ingredients = db.relationship("RecipeIngredient", back_populates="recipe",
                                   cascade="all, delete-orphan", order_by="RecipeIngredient.sort_order")
    versions = db.relationship("RecipeVersion", back_populates="recipe", cascade="all, delete-orphan")
    batches = db.relationship("Batch", back_populates="recipe")

    def to_dict(self, include_ingredients=False):
        d = {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "yield_amount": float(self.yield_amount) if self.yield_amount else None,
            "yield_unit": self.yield_unit,
            "yield_count": self.yield_count,
            "version": self.version,
            "is_archived": self.is_archived,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_ingredients:
            d["ingredients"] = [ri.to_dict() for ri in self.ingredients]
        return d


class RecipeIngredient(db.Model):
    __tablename__ = "recipe_ingredients"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    recipe_id = db.Column(db.String(36), db.ForeignKey("recipes.id"), nullable=False)
    ingredient_id = db.Column(db.String(36), db.ForeignKey("ingredients.id"), nullable=False)
    amount = db.Column(db.Numeric(12, 4), nullable=False)
    unit = db.Column(db.String(20), default="g")
    phase = db.Column(db.String(50))                # water_phase, oil_phase, cool_down, etc.
    sort_order = db.Column(db.Integer, default=0)
    notes = db.Column(db.String(500))

    recipe = db.relationship("Recipe", back_populates="ingredients")
    ingredient = db.relationship("Ingredient")

    def to_dict(self):
        return {
            "id": self.id,
            "recipe_id": self.recipe_id,
            "ingredient_id": self.ingredient_id,
            "ingredient_name": self.ingredient.name if self.ingredient else None,
            "inci_name": self.ingredient.inci_name if self.ingredient else None,
            "amount": float(self.amount),
            "unit": self.unit,
            "phase": self.phase,
            "sort_order": self.sort_order,
            "notes": self.notes,
            "cost_per_unit": float(self.ingredient.cost_per_unit) if self.ingredient and self.ingredient.cost_per_unit else None,
        }


class RecipeVersion(db.Model):
    """Immutable snapshot taken when a batch is logged against a recipe."""
    __tablename__ = "recipe_versions"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    recipe_id = db.Column(db.String(36), db.ForeignKey("recipes.id"), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    snapshot = db.Column(db.JSON)                   # full recipe + ingredients at time of batch
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    recipe = db.relationship("Recipe", back_populates="versions")


# ─── Batches ──────────────────────────────────────────────────────────────────

class Batch(db.Model):
    __tablename__ = "batches"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey("tenants.id"), nullable=False)
    recipe_id = db.Column(db.String(36), db.ForeignKey("recipes.id"))
    recipe_version_id = db.Column(db.String(36), db.ForeignKey("recipe_versions.id"))
    batch_number = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default="planned")  # planned, in_progress, complete, failed
    scale_factor = db.Column(db.Numeric(8, 4), default=1.0)  # multiplier vs base recipe
    yield_actual = db.Column(db.Numeric(12, 4))
    yield_unit = db.Column(db.String(20), default="g")
    unit_count = db.Column(db.Integer)
    made_at = db.Column(db.DateTime)
    made_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    tenant = db.relationship("Tenant", back_populates="batches")
    recipe = db.relationship("Recipe", back_populates="batches")
    recipe_version = db.relationship("RecipeVersion")
    ingredient_usage = db.relationship("BatchIngredient", back_populates="batch",
                                        cascade="all, delete-orphan")

    def to_dict(self, include_ingredients=False):
        d = {
            "id": self.id,
            "batch_number": self.batch_number,
            "recipe_id": self.recipe_id,
            "recipe_name": self.recipe.name if self.recipe else None,
            "status": self.status,
            "scale_factor": float(self.scale_factor) if self.scale_factor else 1.0,
            "yield_actual": float(self.yield_actual) if self.yield_actual else None,
            "yield_unit": self.yield_unit,
            "unit_count": self.unit_count,
            "made_at": self.made_at.isoformat() if self.made_at else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }
        if include_ingredients:
            d["ingredients"] = [bi.to_dict() for bi in self.ingredient_usage]
        return d


class BatchIngredient(db.Model):
    """Actual ingredients used in a batch — linked to specific lots for traceability."""
    __tablename__ = "batch_ingredients"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    batch_id = db.Column(db.String(36), db.ForeignKey("batches.id"), nullable=False)
    ingredient_id = db.Column(db.String(36), db.ForeignKey("ingredients.id"), nullable=False)
    lot_id = db.Column(db.String(36), db.ForeignKey("ingredient_lots.id"))
    amount_used = db.Column(db.Numeric(12, 4), nullable=False)
    unit = db.Column(db.String(20), default="g")

    batch = db.relationship("Batch", back_populates="ingredient_usage")
    ingredient = db.relationship("Ingredient")
    lot = db.relationship("IngredientLot")

    def to_dict(self):
        return {
            "id": self.id,
            "ingredient_id": self.ingredient_id,
            "ingredient_name": self.ingredient.name if self.ingredient else None,
            "lot_id": self.lot_id,
            "lot_number": self.lot.lot_number if self.lot else None,
            "amount_used": float(self.amount_used),
            "unit": self.unit,
        }


# ─── Inventory Ledger ─────────────────────────────────────────────────────────

class InventoryTransaction(db.Model):
    """Append-only ledger. Stock on hand = sum of all deltas for an ingredient."""
    __tablename__ = "inventory_transactions"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey("tenants.id"), nullable=False)
    ingredient_id = db.Column(db.String(36), db.ForeignKey("ingredients.id"), nullable=False)
    lot_id = db.Column(db.String(36), db.ForeignKey("ingredient_lots.id"))
    quantity_delta = db.Column(db.Numeric(12, 4), nullable=False)  # + purchase, - usage/waste
    reason = db.Column(db.String(50))  # purchase, batch_use, adjustment, waste, return
    reference_id = db.Column(db.String(36))   # batch_id or lot_id that caused this
    reference_type = db.Column(db.String(50)) # "batch" or "lot"
    notes = db.Column(db.String(500))
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    ingredient = db.relationship("Ingredient")

    def to_dict(self):
        return {
            "id": self.id,
            "ingredient_id": self.ingredient_id,
            "ingredient_name": self.ingredient.name if self.ingredient else None,
            "lot_id": self.lot_id,
            "quantity_delta": float(self.quantity_delta),
            "reason": self.reason,
            "reference_id": self.reference_id,
            "reference_type": self.reference_type,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }
