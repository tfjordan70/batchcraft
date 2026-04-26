from flask import Blueprint, jsonify
from app.api.helpers import tenant_required
bp = Blueprint("tenants", __name__)

@bp.route("/me", methods=["GET"])
@tenant_required
def get_tenant(tenant_id, current_user):
    return jsonify(current_user.tenant.to_dict())
