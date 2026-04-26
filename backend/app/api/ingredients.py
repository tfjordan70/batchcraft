from flask import Blueprint, request, jsonify
from app import db
from app.models import Ingredient, IngredientLot, InventoryTransaction
from app.api.helpers import tenant_required, require_role

bp = Blueprint("ingredients", __name__)


@bp.route("/", methods=["GET"])
@tenant_required
def list_ingredients(tenant_id, current_user):
    category = request.args.get("category")
    search = request.args.get("q")
    include_stock = request.args.get("stock", "false").lower() == "true"

    q = Ingredient.query.filter_by(tenant_id=tenant_id, is_active=True)
    if category:
        q = q.filter_by(category=category)
    if search:
        q = q.filter(Ingredient.name.ilike(f"%{search}%"))

    ingredients = q.order_by(Ingredient.name).all()
    return jsonify([i.to_dict(include_stock=include_stock) for i in ingredients])


@bp.route("/", methods=["POST"])
@tenant_required
def create_ingredient(tenant_id, current_user):
    data = request.get_json()
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400

    ingredient = Ingredient(
        tenant_id=tenant_id,
        name=data["name"],
        inci_name=data.get("inci_name"),
        category=data.get("category"),
        unit=data.get("unit", "g"),
        cost_per_unit=data.get("cost_per_unit"),
        supplier=data.get("supplier"),
        cas_number=data.get("cas_number"),
        sap_value_naoh=data.get("sap_value_naoh"),
        sap_value_koh=data.get("sap_value_koh"),
        max_usage_pct=data.get("max_usage_pct"),
        notes=data.get("notes"),
        safety_notes=data.get("safety_notes"),
    )
    db.session.add(ingredient)
    db.session.commit()
    return jsonify(ingredient.to_dict()), 201


@bp.route("/<ingredient_id>", methods=["GET"])
@tenant_required
def get_ingredient(tenant_id, current_user, ingredient_id):
    ingredient = Ingredient.query.filter_by(id=ingredient_id, tenant_id=tenant_id).first_or_404()
    d = ingredient.to_dict(include_stock=True)
    d["lots"] = [lot.to_dict() for lot in ingredient.lots]
    return jsonify(d)


@bp.route("/<ingredient_id>", methods=["PUT"])
@tenant_required
def update_ingredient(tenant_id, current_user, ingredient_id):
    ingredient = Ingredient.query.filter_by(id=ingredient_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    fields = ["name", "inci_name", "category", "unit", "cost_per_unit",
              "supplier", "cas_number", "sap_value_naoh", "sap_value_koh",
              "max_usage_pct", "notes", "safety_notes"]
    for field in fields:
        if field in data:
            setattr(ingredient, field, data[field])

    db.session.commit()
    return jsonify(ingredient.to_dict())


@bp.route("/<ingredient_id>", methods=["DELETE"])
@tenant_required
@require_role("owner", "admin")
def delete_ingredient(tenant_id, current_user, ingredient_id):
    ingredient = Ingredient.query.filter_by(id=ingredient_id, tenant_id=tenant_id).first_or_404()
    ingredient.is_active = False  # soft delete
    db.session.commit()
    return jsonify({"message": "Ingredient archived"})


# ─── Lots ─────────────────────────────────────────────────────────────────────

@bp.route("/<ingredient_id>/lots", methods=["POST"])
@tenant_required
def add_lot(tenant_id, current_user, ingredient_id):
    ingredient = Ingredient.query.filter_by(id=ingredient_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    lot = IngredientLot(
        ingredient_id=ingredient.id,
        lot_number=data.get("lot_number"),
        supplier_lot=data.get("supplier_lot"),
        purchased_at=data.get("purchased_at"),
        expiry_date=data.get("expiry_date"),
        quantity_received=data.get("quantity_received"),
        cost_per_unit=data.get("cost_per_unit"),
        notes=data.get("notes"),
    )
    db.session.add(lot)
    db.session.flush()

    # Auto-create inventory transaction for the received quantity
    if lot.quantity_received:
        txn = InventoryTransaction(
            tenant_id=tenant_id,
            ingredient_id=ingredient.id,
            lot_id=lot.id,
            quantity_delta=lot.quantity_received,
            reason="purchase",
            reference_id=lot.id,
            reference_type="lot",
            created_by=current_user.id,
        )
        db.session.add(txn)

    db.session.commit()
    return jsonify(lot.to_dict()), 201


@bp.route("/<ingredient_id>/transactions", methods=["GET"])
@tenant_required
def get_transactions(tenant_id, current_user, ingredient_id):
    ingredient = Ingredient.query.filter_by(id=ingredient_id, tenant_id=tenant_id).first_or_404()
    txns = InventoryTransaction.query.filter_by(ingredient_id=ingredient.id)\
        .order_by(InventoryTransaction.created_at.desc()).all()
    return jsonify([t.to_dict() for t in txns])
