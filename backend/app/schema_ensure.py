"""Lightweight DDL for environments where Alembic revisions are not applied yet."""

from sqlalchemy import inspect, text

from app import db


def ensure_recipe_ingredient_line_columns() -> None:
    """Allow recipe lines without an Ingredient (lye, water) via line_name + nullable FK."""
    if db.engine.dialect.name != "postgresql":
        return
    insp = inspect(db.engine)
    if "recipe_ingredients" not in insp.get_table_names():
        return
    col_names = {c["name"] for c in insp.get_columns("recipe_ingredients")}
    with db.engine.begin() as conn:
        if "line_name" not in col_names:
            conn.execute(text("ALTER TABLE recipe_ingredients ADD COLUMN line_name VARCHAR(200)"))
        conn.execute(text("ALTER TABLE recipe_ingredients ALTER COLUMN ingredient_id DROP NOT NULL"))
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_recipe_ingredients_line_or_ingredient'
                    ) THEN
                        ALTER TABLE recipe_ingredients ADD CONSTRAINT ck_recipe_ingredients_line_or_ingredient
                        CHECK (
                            ingredient_id IS NOT NULL
                            OR (line_name IS NOT NULL AND trim(line_name) <> '')
                        );
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_batch_cure_columns() -> None:
    """Cure window, retail soap name, cure-done timestamp, and photo metadata on batches."""
    if db.engine.dialect.name != "postgresql":
        return
    insp = inspect(db.engine)
    if "batches" not in insp.get_table_names():
        return
    col_names = {c["name"] for c in insp.get_columns("batches")}
    with db.engine.begin() as conn:
        if "cure_started_at" not in col_names:
            conn.execute(text("ALTER TABLE batches ADD COLUMN cure_started_at TIMESTAMP"))
        if "cure_weeks_min" not in col_names:
            conn.execute(text("ALTER TABLE batches ADD COLUMN cure_weeks_min NUMERIC(5,2)"))
        if "cure_weeks_max" not in col_names:
            conn.execute(text("ALTER TABLE batches ADD COLUMN cure_weeks_max NUMERIC(5,2)"))
        if "soap_name" not in col_names:
            conn.execute(text("ALTER TABLE batches ADD COLUMN soap_name VARCHAR(200)"))
        if "cure_complete_at" not in col_names:
            conn.execute(text("ALTER TABLE batches ADD COLUMN cure_complete_at TIMESTAMP"))
        if "images" not in col_names:
            conn.execute(
                text(
                    "ALTER TABLE batches ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb"
                )
            )
