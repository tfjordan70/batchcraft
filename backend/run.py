from app import create_app, db
from app.models import Tenant, User, Ingredient, Recipe, Batch

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {"db": db, "Tenant": Tenant, "User": User,
            "Ingredient": Ingredient, "Recipe": Recipe, "Batch": Batch}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
