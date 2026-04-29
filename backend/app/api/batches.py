from pathlib import Path
import uuid

from flask import Blueprint, request, jsonify, current_app, send_file
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from app import db
from app.models import Batch, BatchIngredient, RecipeVersion, InventoryTransaction, Recipe
from app.api.helpers import tenant_required
from app.api.recipes import snapshot_recipe

bp = Blueprint("batches", __name__)

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGES_PER_BATCH = 30

MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def gen_batch_number(tenant_id):
    """Generate sequential batch number: BC-YYYYMMDD-XXXX"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = Batch.query.filter(
        Batch.tenant_id == tenant_id,
        Batch.batch_number.like(f"BC-{today}-%")
    ).count()
    return f"BC-{today}-{(count + 1):04d}"


def _parse_datetime(val):
    if val is None or val == "":
        return None
    if isinstance(val, str):
        s = val.strip().replace("Z", "+00:00") if val.endswith("Z") else val.strip()
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    return None


def _batch_images_list(batch):
    raw = batch.images
    return list(raw) if isinstance(raw, list) else []


def _upload_root():
    root = current_app.config.get("UPLOAD_FOLDER")
    if not root:
        root = Path(current_app.root_path) / "instance" / "uploads"
    return Path(root)


def _batch_image_dir(tenant_id, batch_id):
    return _upload_root() / tenant_id / batch_id


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
        soap_name=(data.get("soap_name") or "").strip() or None,
    )

    if data.get("made_at"):
        batch.made_at = _parse_datetime(data["made_at"])
    if data.get("cure_started_at"):
        batch.cure_started_at = _parse_datetime(data["cure_started_at"])
    if data.get("cure_weeks_min") is not None:
        batch.cure_weeks_min = data["cure_weeks_min"]
    if data.get("cure_weeks_max") is not None:
        batch.cure_weeks_max = data["cure_weeks_max"]

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
    if batch.cure_started_at is None:
        batch.cure_started_at = batch.made_at
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


def _apply_batch_meta(batch, data, locked):
    """Update notes, yield, cure, soap name — allowed for complete and incomplete batches."""
    for field in ("notes", "yield_actual", "yield_unit", "unit_count"):
        if field in data:
            setattr(batch, field, data[field])

    if "soap_name" in data:
        sn = (data.get("soap_name") or "").strip()
        batch.soap_name = sn or None

    if "cure_started_at" in data:
        batch.cure_started_at = _parse_datetime(data.get("cure_started_at"))

    if "cure_weeks_min" in data:
        v = data.get("cure_weeks_min")
        if v is None or v == "":
            batch.cure_weeks_min = None
        else:
            try:
                batch.cure_weeks_min = Decimal(str(v))
            except (InvalidOperation, TypeError, ValueError):
                return jsonify({"error": "Invalid cure_weeks_min"}), 400

    if "cure_weeks_max" in data:
        v = data.get("cure_weeks_max")
        if v is None or v == "":
            batch.cure_weeks_max = None
        else:
            try:
                batch.cure_weeks_max = Decimal(str(v))
            except (InvalidOperation, TypeError, ValueError):
                return jsonify({"error": "Invalid cure_weeks_max"}), 400

    if "cure_complete_at" in data:
        batch.cure_complete_at = _parse_datetime(data.get("cure_complete_at"))

    if not locked:
        if "batch_number" in data:
            bn = (data.get("batch_number") or "").strip()
            if not bn:
                return jsonify({"error": "Batch number cannot be empty"}), 400
            batch.batch_number = bn

        if "scale_factor" in data and data["scale_factor"] is not None:
            try:
                sf = float(data["scale_factor"])
            except (TypeError, ValueError):
                return jsonify({"error": "Invalid scale_factor"}), 400
            if sf <= 0:
                return jsonify({"error": "scale_factor must be positive"}), 400
            batch.scale_factor = sf

        if "recipe_id" in data:
            new_rid = data["recipe_id"] or None
            if new_rid != batch.recipe_id:
                batch.recipe_id = new_rid
                if new_rid:
                    recipe = Recipe.query.filter_by(id=new_rid, tenant_id=tenant_id).first_or_404()
                    version = RecipeVersion(
                        recipe_id=recipe.id,
                        version_number=recipe.version,
                        snapshot=snapshot_recipe(recipe),
                    )
                    db.session.add(version)
                    db.session.flush()
                    batch.recipe_version_id = version.id
                    if not data.get("yield_unit"):
                        batch.yield_unit = recipe.yield_unit
                else:
                    batch.recipe_version_id = None

        if "status" in data:
            st = data["status"]
            if st == "complete":
                return jsonify({"error": "Use POST /batches/<id>/complete to finish a batch"}), 400
            if st not in ("planned", "in_progress", "failed"):
                return jsonify({"error": "Invalid status"}), 400
            batch.status = st

    return None


@bp.route("/<batch_id>", methods=["PUT"])
@tenant_required
def update_batch(tenant_id, current_user, batch_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json() or {}
    locked = batch.status == "complete"

    forbidden_when_complete = ("batch_number", "recipe_id", "scale_factor", "status")
    if locked:
        for key in forbidden_when_complete:
            if key in data:
                return jsonify({"error": f"Cannot change {key.replace('_', ' ')} on a completed batch"}), 400

    err = _apply_batch_meta(batch, data, locked)
    if err:
        db.session.rollback()
        return err

    db.session.commit()
    return jsonify(batch.to_dict())


@bp.route("/<batch_id>/cure-complete", methods=["POST"])
@tenant_required
def mark_cure_complete(tenant_id, current_user, batch_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    batch.cure_complete_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(batch.to_dict())


@bp.route("/<batch_id>/cure-complete", methods=["DELETE"])
@tenant_required
def clear_cure_complete(tenant_id, current_user, batch_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    batch.cure_complete_at = None
    db.session.commit()
    return jsonify(batch.to_dict())


@bp.route("/<batch_id>/images/<image_id>/file", methods=["GET"])
@tenant_required
def get_batch_image_file(tenant_id, current_user, batch_id, image_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    images = _batch_images_list(batch)
    entry = next((x for x in images if x.get("id") == image_id), None)
    if not entry or not entry.get("filename"):
        return jsonify({"error": "Image not found"}), 404
    path = _batch_image_dir(tenant_id, batch_id) / entry["filename"]
    if not path.is_file():
        return jsonify({"error": "File missing"}), 404
    ext = Path(entry["filename"]).suffix.lower()
    return send_file(path, mimetype=MIME_BY_EXT.get(ext, "application/octet-stream"))


@bp.route("/<batch_id>/images", methods=["POST"])
@tenant_required
def upload_batch_image(tenant_id, current_user, batch_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    if not f or not f.filename:
        return jsonify({"error": "No file"}), 400

    ext = Path(f.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXT:
        return jsonify({"error": f"Allowed types: {', '.join(sorted(ALLOWED_IMAGE_EXT))}"}), 400

    images = _batch_images_list(batch)
    if len(images) >= MAX_IMAGES_PER_BATCH:
        return jsonify({"error": "Too many images for this batch"}), 400

    img_id = str(uuid.uuid4())
    safe_name = img_id + ext
    folder = _batch_image_dir(tenant_id, batch_id)
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / safe_name
    f.save(dest)

    if dest.stat().st_size > MAX_IMAGE_BYTES:
        dest.unlink(missing_ok=True)
        return jsonify({"error": "File too large (max 8MB)"}), 400

    caption = (request.form.get("caption") or "").strip()[:200]
    images.append({"id": img_id, "filename": safe_name, "caption": caption})
    batch.images = images
    db.session.commit()
    return jsonify(batch.to_dict())


@bp.route("/<batch_id>/images/<image_id>", methods=["DELETE"])
@tenant_required
def delete_batch_image(tenant_id, current_user, batch_id, image_id):
    batch = Batch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    images = _batch_images_list(batch)
    entry = next((x for x in images if x.get("id") == image_id), None)
    if not entry:
        return jsonify({"error": "Image not found"}), 404

    path = _batch_image_dir(tenant_id, batch_id) / entry.get("filename", "")
    new_list = [x for x in images if x.get("id") != image_id]
    batch.images = new_list
    db.session.commit()
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
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
