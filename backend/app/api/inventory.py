from flask import Blueprint, request, jsonify
from app.api.helpers import tenant_required
bp = Blueprint("inventory", __name__)

@bp.route("/", methods=["GET"])
@tenant_required
def list_inventory(tenant_id, current_user):
    from app.models import Ingredient
    ingredients = Ingredient.query.filter_by(tenant_id=tenant_id, is_active=True).all()
    return jsonify([i.to_dict(include_stock=True) for i in ingredients])

@bp.route("/adjust", methods=["POST"])
@tenant_required
def adjust_inventory(tenant_id, current_user):
    from app import db
    from app.models import InventoryTransaction
    data = request.get_json()
    txn = InventoryTransaction(
        tenant_id=tenant_id,
        ingredient_id=data["ingredient_id"],
        quantity_delta=data["quantity_delta"],
        reason="adjustment",
        notes=data.get("notes"),
        created_by=current_user.id,
    )
    db.session.add(txn)
    db.session.commit()
    return jsonify(txn.to_dict()), 201
