from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
import re
from app import db
from app.models import User, Tenant

bp = Blueprint("auth", __name__)


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:50]


@bp.route("/register", methods=["POST"])
def register():
    """Register a new tenant + owner account."""
    data = request.get_json()
    required = ["email", "password", "name", "business_name"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    # Generate unique slug
    base_slug = slugify(data["business_name"])
    slug = base_slug
    counter = 1
    while Tenant.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    tenant = Tenant(name=data["business_name"], slug=slug)
    db.session.add(tenant)
    db.session.flush()

    if User.query.filter_by(tenant_id=tenant.id, email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        tenant_id=tenant.id,
        email=data["email"],
        password_hash=generate_password_hash(data["password"]),
        name=data["name"],
        role="owner",
    )
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(
        identity=user.id,
        additional_claims={"tenant_id": tenant.id, "role": user.role}
    )
    refresh_token = create_refresh_token(identity=user.id)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
        "tenant": tenant.to_dict(),
    }), 201


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    # Find user across tenants by email (tenant determined by slug header or body)
    tenant_slug = data.get("tenant_slug") or request.headers.get("X-Tenant-Slug")
    if tenant_slug:
        tenant = Tenant.query.filter_by(slug=tenant_slug).first()
        if not tenant:
            return jsonify({"error": "Tenant not found"}), 404
        user = User.query.filter_by(tenant_id=tenant.id, email=data["email"]).first()
    else:
        user = User.query.filter_by(email=data["email"]).first()

    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"error": "Account disabled"}), 403

    access_token = create_access_token(
        identity=user.id,
        additional_claims={"tenant_id": user.tenant_id, "role": user.role}
    )
    refresh_token = create_refresh_token(identity=user.id)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
        "tenant": user.tenant.to_dict(),
    })


@bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    access_token = create_access_token(
        identity=user.id,
        additional_claims={"tenant_id": user.tenant_id, "role": user.role}
    )
    return jsonify({"access_token": access_token})


@bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict(), "tenant": user.tenant.to_dict()})
