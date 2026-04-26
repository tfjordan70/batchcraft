from pathlib import Path

from dotenv import load_dotenv

# Repo-root .env (same directory as docker-compose.yml). Docker Compose injects env
# into the container, but local `flask run` / gunicorn from ./backend needs this.
_repo_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_repo_root / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from app.api.auth import bp as auth_bp
    from app.api.tenants import bp as tenants_bp
    from app.api.ingredients import bp as ingredients_bp
    from app.api.recipes import bp as recipes_bp
    from app.api.batches import bp as batches_bp
    from app.api.inventory import bp as inventory_bp
    from app.api.reports import bp as reports_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tenants_bp, url_prefix="/api/tenants")
    app.register_blueprint(ingredients_bp, url_prefix="/api/ingredients")
    app.register_blueprint(recipes_bp, url_prefix="/api/recipes")
    app.register_blueprint(batches_bp, url_prefix="/api/batches")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")

    return app
