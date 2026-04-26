from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from app import db
from app.models import Batch, BatchIngredient, RecipeVersion, InventoryTransaction, Recipe
from app.api.helpers import tenant_required
from app.api.recipes import snapshot_recipe
import uuid

bp = Blueprint("batches", __name__)


def gen_batch_number(tenant_id):
    """Generate sequential batch number: BC-YYYYMMDD-XXXX"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = Batch.query.filter(
        Batch.tenant_id == tenant_id,
        Batch.batch_number.like(f"BC-{today}-%")
    ).count()
    return f"BC-{today}-{(count + 1):04d}"


@bp.route("/", methods=["GET"])
@tenant_required
def list_batches(tenant_id, current_user):
    status = request.args.get("status")
    recipe_id = request.args.get("recipe_id")

    q = Batch.query.filter_by(tenant_id=tenant_id)
    if status:
        q = q.filter_by(status=status)
    if recipe_id:
        q = q.filter_by(recipe_id=recipe_id)

    batches = q.order_by(Batch.created_at.desc()).all()
    return jsonify([b.to_dict() for b in batches])


@bp.route("/", methods=["POST"])
@tenant_required
def create_batch(tenant_id, current_user):
    data = request.get_json()

    recipe = None
    if data.get("recipe_id"):
        recipe = Recipe.query.filter_by(id=data["recipe_id"], tenant_id=tenant_id).first_or_404()

    batch = Batch(
        tenant_id=tenant_id,
        recipe_id=data.get("recipe_id"),
        batch_number=data.get("batch_number") or gen_batch_number(tenant_id),
        status=data.get("status", "planned"),
        scale_factor=data.get("scale_factor", 1.0),
        yield_unit=recipe.yield_unit if recipe else data.get("yield_unit", "g"),
        notes=data.get("notes"),
        made_by=current_user.id,
    )

    if data.get("made_at"):
        batch.made_at = datetime.fromisoformat(data["made_at"])

    db.session.add(batch)
    db.session.flush()

    # Snapshot recipe version for traceability
    if recipe:
        version = RecipeVersion(
            recipe_id=recipe.id,
            version_number=recipe.version,
            snapshot=snapshot_recipe(recipe),
        )
        db.session.add(version)
        db.session.flush()
        batch.recipe_version_id = version.id

    db.session.commit()
    return jsonify(batch.to_dict()), 201


@bp.route("/<batch_id>", methods=["GET"])
@tenant_required
def get_batch(tenant_id, current_user, batch_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    return jsonify(batch.to_dict(include_ingredients=True))


@bp.route("/<batch_id>/complete", methods=["POST"])
@tenant_required
def complete_batch(tenant_id, current_user, batch_id):
    """
    Mark batch complete, record actual ingredient usage, 
    and deduct from inventory ledger.
    """
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    batch.status = "complete"
    batch.made_at = datetime.now(timezone.utc)
    if data.get("yield_actual"):
        batch.yield_actual = data["yield_actual"]
    if data.get("unit_count"):
        batch.unit_count = data["unit_count"]
    if data.get("notes"):
        batch.notes = data["notes"]

    # Record ingredient usage and deduct inventory
    for usage in data.get("ingredients", []):
        bi = BatchIngredient(
            batch_id=batch.id,
            ingredient_id=usage["ingredient_id"],
            lot_id=usage.get("lot_id"),
            amount_used=usage["amount_used"],
            unit=usage.get("unit", "g"),
        )
        db.session.add(bi)

        # Deduct from ledger
        txn = InventoryTransaction(
            tenant_id=tenant_id,
            ingredient_id=usage["ingredient_id"],
            lot_id=usage.get("lot_id"),
            quantity_delta=-float(usage["amount_used"]),
            reason="batch_use",
            reference_id=batch.id,
            reference_type="batch",
            created_by=current_user.id,
        )
        db.session.add(txn)

    db.session.commit()
    return jsonify(batch.to_dict(include_ingredients=True))


@bp.route("/<batch_id>", methods=["PUT"])
@tenant_required
def update_batch(tenant_id, current_user, batch_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    for field in ["status", "notes", "yield_actual", "yield_unit", "unit_count"]:
        if field in data:
            setattr(batch, field, data[field])

    db.session.commit()
    return jsonify(batch.to_dict())


@bp.route("/<batch_id>/traceability", methods=["GET"])
@tenant_required
def batch_traceability(tenant_id, current_user, batch_id):
    """Full traceability report for a batch — recipe snapshot + lots used."""
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()

    report = {
        "batch_number": batch.batch_number,
        "made_at": batch.made_at.isoformat() if batch.made_at else None,
        "recipe_snapshot": batch.recipe_version.snapshot if batch.recipe_version else None,
        "ingredients_used": [bi.to_dict() for bi in batch.ingredient_usage],
    }
    return jsonify(report)
