from flask import Blueprint, jsonify
from app.api.helpers import tenant_required
bp = Blueprint("reports", __name__)

@bp.route("/dashboard", methods=["GET"])
@tenant_required
def dashboard(tenant_id, current_user):
    from app.models import Recipe, Batch, Ingredient, InventoryTransaction
    from app import db
    recipe_count = Recipe.query.filter_by(tenant_id=tenant_id, is_archived=False).count()
    batch_count = Batch.query.filter_by(tenant_id=tenant_id).count()
    recent_batches = Batch.query.filter_by(tenant_id=tenant_id)\
        .order_by(Batch.created_at.desc()).limit(5).all()
    low_stock = []
    ingredients = Ingredient.query.filter_by(tenant_id=tenant_id, is_active=True).all()
    for ing in ingredients:
        stock = ing.stock_on_hand
        if stock < 50:
            low_stock.append({"ingredient": ing.to_dict(), "stock": stock})
    return jsonify({
        "recipe_count": recipe_count,
        "batch_count": batch_count,
        "recent_batches": [b.to_dict() for b in recent_batches],
        "low_stock_alerts": low_stock[:10],
    })
