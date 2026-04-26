from flask import Blueprint, request, jsonify
from app import db
from app.models import Recipe, RecipeIngredient, RecipeVersion, Ingredient
from app.api.helpers import tenant_required, require_role
import json

bp = Blueprint("recipes", __name__)


@bp.route("/", methods=["GET"])
@tenant_required
def list_recipes(tenant_id, current_user):
    category = request.args.get("category")
    search = request.args.get("q")
    include_archived = request.args.get("archived", "false").lower() == "true"

    q = Recipe.query.filter_by(tenant_id=tenant_id)
    if not include_archived:
        q = q.filter_by(is_archived=False)
    if category:
        q = q.filter_by(category=category)
    if search:
        q = q.filter(Recipe.name.ilike(f"%{search}%"))

    recipes = q.order_by(Recipe.name).all()
    return jsonify([r.to_dict() for r in recipes])


@bp.route("/", methods=["POST"])
@tenant_required
def create_recipe(tenant_id, current_user):
    data = request.get_json()
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400

    recipe = Recipe(
        tenant_id=tenant_id,
        name=data["name"],
        category=data.get("category"),
        description=data.get("description"),
        yield_amount=data.get("yield_amount"),
        yield_unit=data.get("yield_unit", "g"),
        yield_count=data.get("yield_count"),
        notes=data.get("notes"),
        created_by=current_user.id,
    )
    db.session.add(recipe)
    db.session.flush()

    # Add ingredients if provided
    for i, ing_data in enumerate(data.get("ingredients", [])):
        ri = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ing_data["ingredient_id"],
            amount=ing_data["amount"],
            unit=ing_data.get("unit", "g"),
            phase=ing_data.get("phase"),
            sort_order=ing_data.get("sort_order", i),
            notes=ing_data.get("notes"),
        )
        db.session.add(ri)

    db.session.commit()
    return jsonify(recipe.to_dict(include_ingredients=True)), 201


@bp.route("/<recipe_id>", methods=["GET"])
@tenant_required
def get_recipe(tenant_id, current_user, recipe_id):
    recipe = Recipe.query.filter_by(id=recipe_id, tenant_id=tenant_id).first_or_404()
    return jsonify(recipe.to_dict(include_ingredients=True))


@bp.route("/<recipe_id>", methods=["PUT"])
@tenant_required
def update_recipe(tenant_id, current_user, recipe_id):
    recipe = Recipe.query.filter_by(id=recipe_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    fields = ["name", "category", "description", "yield_amount",
              "yield_unit", "yield_count", "notes"]
    for field in fields:
        if field in data:
            setattr(recipe, field, data[field])

    # Replace ingredients if provided
    if "ingredients" in data:
        RecipeIngredient.query.filter_by(recipe_id=recipe.id).delete()
        for i, ing_data in enumerate(data["ingredients"]):
            ri = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ing_data["ingredient_id"],
                amount=ing_data["amount"],
                unit=ing_data.get("unit", "g"),
                phase=ing_data.get("phase"),
                sort_order=ing_data.get("sort_order", i),
                notes=ing_data.get("notes"),
            )
            db.session.add(ri)
        recipe.version += 1

    db.session.commit()
    return jsonify(recipe.to_dict(include_ingredients=True))


@bp.route("/<recipe_id>/archive", methods=["POST"])
@tenant_required
def archive_recipe(tenant_id, current_user, recipe_id):
    recipe = Recipe.query.filter_by(id=recipe_id, tenant_id=tenant_id).first_or_404()
    recipe.is_archived = True
    db.session.commit()
    return jsonify({"message": "Recipe archived"})


@bp.route("/<recipe_id>/scale", methods=["POST"])
@tenant_required
def scale_recipe(tenant_id, current_user, recipe_id):
    """Return scaled ingredient amounts without saving."""
    recipe = Recipe.query.filter_by(id=recipe_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    scale_factor = None
    if "target_yield" in data and recipe.yield_amount:
        scale_factor = float(data["target_yield"]) / float(recipe.yield_amount)
    elif "scale_factor" in data:
        scale_factor = float(data["scale_factor"])
    elif "unit_count" in data and recipe.yield_count:
        scale_factor = float(data["unit_count"]) / float(recipe.yield_count)

    if not scale_factor:
        return jsonify({"error": "Provide target_yield, scale_factor, or unit_count"}), 400

    scaled = []
    total_cost = 0
    for ri in recipe.ingredients:
        scaled_amount = float(ri.amount) * scale_factor
        cost = None
        if ri.ingredient and ri.ingredient.cost_per_unit:
            cost = scaled_amount * float(ri.ingredient.cost_per_unit)
            total_cost += cost
        scaled.append({
            **ri.to_dict(),
            "amount_scaled": round(scaled_amount, 4),
            "line_cost": round(cost, 4) if cost else None,
        })

    return jsonify({
        "scale_factor": round(scale_factor, 4),
        "yield_scaled": round(float(recipe.yield_amount or 0) * scale_factor, 4),
        "yield_unit": recipe.yield_unit,
        "ingredients": scaled,
        "total_cost": round(total_cost, 4),
        "cost_per_unit": round(total_cost / (float(recipe.yield_count or 1) * scale_factor), 4) if total_cost else None,
    })


def snapshot_recipe(recipe):
    """Create an immutable JSON snapshot of the current recipe state."""
    return {
        "id": recipe.id,
        "name": recipe.name,
        "category": recipe.category,
        "version": recipe.version,
        "yield_amount": float(recipe.yield_amount) if recipe.yield_amount else None,
        "yield_unit": recipe.yield_unit,
        "ingredients": [
            {
                "ingredient_id": ri.ingredient_id,
                "name": ri.ingredient.name,
                "inci_name": ri.ingredient.inci_name,
                "amount": float(ri.amount),
                "unit": ri.unit,
                "phase": ri.phase,
            }
            for ri in recipe.ingredients
        ],
    }
