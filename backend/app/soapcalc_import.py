"""Import MIT soap-calc oil rows (SoapCalc.net–compatible SAP) as tenant ingredients."""

from __future__ import annotations

import json
from pathlib import Path

import click

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "soapcalc_oils.json"


def infer_category(oil_name: str) -> str:
    n = oil_name.lower()
    if "butter" in n:
        return "butter"
    if "wax" in n:
        return "wax"
    return "oil"


def register_soapcalc_cli(app):
    """Register `flask import-soapcalc-oils` (see --help)."""

    @app.cli.command("import-soapcalc-oils")
    @click.option(
        "--tenant-id",
        required=True,
        help="Tenant UUID to attach ingredients to (same as your workspace tenant_id).",
    )
    @click.option(
        "--update/--no-update",
        default=False,
        help="If an active ingredient with the same name exists, refresh SAP KOH/NaOH from the dataset.",
    )
    @click.option(
        "--dry-run",
        is_flag=True,
        help="Print counts only; do not write to the database.",
    )
    def import_soapcalc_oils(tenant_id: str, update: bool, dry_run: bool) -> None:
        """Load bundled soap-calc oils.json into ingredients for one tenant."""
        from app import db
        from app.models import Ingredient, Tenant

        if not Tenant.query.filter_by(id=tenant_id).first():
            raise click.ClickException(f"No tenant with id={tenant_id!r}")

        if not DATA_FILE.is_file():
            raise click.ClickException(
                f"Missing {DATA_FILE}. Add backend/data/soapcalc_oils.json "
                "(copy from https://github.com/mikewolfd/soap-calc/blob/main/data/oils.json)."
            )

        with open(DATA_FILE, encoding="utf-8") as f:
            oils = json.load(f)

        notes = (
            "SAP from MIT soap-calc oil database (SoapCalc.net–compatible). "
            "Verify with your SDS before production."
        )
        supplier = "soap-calc (SoapCalc-compatible)"

        created = 0
        updated = 0
        skipped_dup = 0
        skipped_bad = 0

        for row in oils:
            name = (row.get("name") or "").strip()
            if not name:
                skipped_bad += 1
                continue
            if len(name) > 200:
                skipped_bad += 1
                continue

            naoh = row.get("sap_naoh")
            koh = row.get("sap_koh")
            if naoh is None and koh is None:
                skipped_bad += 1
                continue
            naoh_f = float(naoh) if naoh is not None else None
            koh_f = float(koh) if koh is not None else None
            if (naoh_f is not None and naoh_f == 0.0) and (koh_f is not None and koh_f == 0.0):
                skipped_bad += 1
                continue

            cat = infer_category(name)
            existing = Ingredient.query.filter_by(
                tenant_id=tenant_id, name=name, is_active=True
            ).first()

            if existing:
                if update:
                    if not dry_run:
                        existing.sap_value_naoh = naoh_f
                        existing.sap_value_koh = koh_f
                        if not existing.category:
                            existing.category = cat
                        if not (existing.supplier or "").strip():
                            existing.supplier = supplier
                        if not (existing.notes or "").strip():
                            existing.notes = notes
                    updated += 1
                else:
                    skipped_dup += 1
                continue

            if dry_run:
                created += 1
                continue

            db.session.add(
                Ingredient(
                    tenant_id=tenant_id,
                    name=name,
                    category=cat,
                    unit="g",
                    supplier=supplier,
                    sap_value_naoh=naoh_f,
                    sap_value_koh=koh_f,
                    notes=notes,
                )
            )
            created += 1

        if not dry_run:
            db.session.commit()

        click.echo(
            f"import-soapcalc-oils: created={created}, updated={updated}, "
            f"skipped_existing={skipped_dup}, skipped_bad_row={skipped_bad}, dry_run={dry_run}"
        )
