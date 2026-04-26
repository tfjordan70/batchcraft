"""OpenAI-assisted ingredient field suggestions (verify all values before production use)."""

import json
import re
import urllib.error
import urllib.request

ALLOWED_CATEGORIES = frozenset({
    "oil", "butter", "lye", "liquid", "wax", "fragrance", "emulsifier",
    "additive", "colorant", "preservative", "other",
})

SYSTEM_PROMPT = """You help soap and cosmetic makers fill ingredient records from a product name and optional supplier name or website.
You cannot browse the web. Use general knowledge about common oils, butters, fragrances (FO/EO), lye, waxes, etc.

Return ONLY a single JSON object (no markdown) with these keys:
- inci_name: string or null (INCI/CTFA name when known)
- category: one of: oil, butter, lye, liquid, wax, fragrance, emulsifier, additive, colorant, preservative, other
- cost_per_gram_usd: number or null — estimated typical retail cost per gram in USD for similar products when reasonable; otherwise null
- sap_value_naoh: number or null — NaOH saponification coefficient per gram of FAT/OIL (typical 0.05–0.22 for oils; null for non-saponifiables like fragrance or water)
- sap_value_koh: number or null — KOH coefficient, often ~1.403× NaOH for same oil; null if NaOH is null
- cas_number: string or null (e.g. 8001-31-8 for coconut oil)
- max_usage_pct: number or null — IFRA skin-safe / typical max usage percent in finished product for fragrances; null if not applicable
- supplier_display: short string summarizing supplier or null
- research_notes: one sentence telling the user to verify SAP/CAS/cost against SDS or supplier COA

SAP values must match common soap calculator style (same as SoapCalc/Bramble Berry style NaOH per 1g oil)."""


def _coerce_category(raw):
    if not raw or not isinstance(raw, str):
        return "other"
    v = raw.strip().lower()
    return v if v in ALLOWED_CATEGORIES else "other"


def _num_or_none(v):
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    if isinstance(v, str) and v.strip():
        try:
            return float(v)
        except ValueError:
            return None
    return None


def _str_or_none(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def lookup_with_openai(name: str, supplier_hint: str | None, api_key: str, model: str) -> dict:
    """Call OpenAI Chat Completions; return normalized dict for API response."""
    user_msg = json.dumps({
        "product_name": name.strip(),
        "supplier_or_website": (supplier_hint or "").strip() or None,
    })
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.25,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI HTTP {e.code}: {err_body[:500]}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"OpenAI connection error: {e}") from e

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError("Unexpected OpenAI response shape") from e

    # Strip accidental markdown fences
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)

    try:
        raw = json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError("OpenAI returned non-JSON") from e

    naoh = _num_or_none(raw.get("sap_value_naoh"))
    koh = _num_or_none(raw.get("sap_value_koh"))
    if naoh is not None and koh is None:
        koh = round(naoh * 1.403, 6)

    notes_parts = []
    rn = _str_or_none(raw.get("research_notes"))
    if rn:
        notes_parts.append(rn)
    if supplier_hint and supplier_hint.strip().startswith(("http://", "https://")):
        notes_parts.append(f"Lookup hint URL: {supplier_hint.strip()}")

    return {
        "inci_name": _str_or_none(raw.get("inci_name")),
        "category": _coerce_category(raw.get("category")),
        "cost_per_unit": _num_or_none(raw.get("cost_per_gram_usd")),
        "unit": "g",
        "sap_value_naoh": naoh,
        "sap_value_koh": koh,
        "cas_number": _str_or_none(raw.get("cas_number")),
        "max_usage_pct": _num_or_none(raw.get("max_usage_pct")),
        "supplier": _str_or_none(raw.get("supplier_display")),
        "notes": "\n\n".join(notes_parts) if notes_parts else None,
    }
