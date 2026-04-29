from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify
from sqlalchemy import func

from app.api.helpers import tenant_required

bp = Blueprint("reports", __name__)

# Ingredients at or below this on-hand quantity appear in low_stock_alerts.
LOW_STOCK_THRESHOLD = 50


@bp.route("/dashboard", methods=["GET"])
@tenant_required
def dashboard(tenant_id, current_user):
    from app.models import Recipe, Batch, Ingredient
    from app import db

    recipe_count = Recipe.query.filter_by(tenant_id=tenant_id, is_archived=False).count()
    batch_count = Batch.query.filter_by(tenant_id=tenant_id).count()
    ingredient_count = Ingredient.query.filter_by(tenant_id=tenant_id, is_active=True).count()

    status_rows = (
        db.session.query(Batch.status, func.count(Batch.id))
        .filter_by(tenant_id=tenant_id)
        .group_by(Batch.status)
        .all()
    )
    batches_by_status = {row[0]: row[1] for row in status_rows}
    open_batch_count = batches_by_status.get("planned", 0) + batches_by_status.get("in_progress", 0)

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    batches_completed_week = (
        Batch.query.filter(
            Batch.tenant_id == tenant_id,
            Batch.status == "complete",
            Batch.created_at >= week_ago,
        ).count()
    )

    recent_batches = (
        Batch.query.filter_by(tenant_id=tenant_id)
        .order_by(Batch.created_at.desc())
        .limit(8)
        .all()
    )

    low_stock = []
    ingredients = Ingredient.query.filter_by(tenant_id=tenant_id, is_active=True).all()
    for ing in ingredients:
        stock = ing.stock_on_hand
        if stock < LOW_STOCK_THRESHOLD:
            low_stock.append({"ingredient": ing.to_dict(), "stock": stock})
    low_stock.sort(key=lambda x: x["stock"])

    return jsonify({
        "recipe_count": recipe_count,
        "batch_count": batch_count,
        "ingredient_count": ingredient_count,
        "batches_by_status": batches_by_status,
        "open_batch_count": open_batch_count,
        "batches_completed_week": batches_completed_week,
        "recent_batches": [b.to_dict() for b in recent_batches],
        "low_stock_alerts": low_stock[:12],
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    })
