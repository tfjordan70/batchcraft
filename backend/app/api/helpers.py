from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.models import User


def tenant_required(f):
    """Decorator: validates JWT and injects tenant_id + current_user into kwargs."""
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        claims = get_jwt()
        tenant_id = claims.get("tenant_id")
        if not tenant_id:
            return jsonify({"error": "Invalid token: no tenant context"}), 401
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.is_active:
            return jsonify({"error": "User not found or inactive"}), 401
        kwargs["tenant_id"] = tenant_id
        kwargs["current_user"] = user
        return f(*args, **kwargs)
    return decorated


def require_role(*roles):
    """Decorator: checks user role after tenant_required."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            current_user = kwargs.get("current_user")
            if current_user and current_user.role not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
