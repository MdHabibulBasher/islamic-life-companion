"""Quran service: thin wrapper around the public AlQuran.cloud API.

API docs: https://alquran.cloud/api
We cache responses in-process for the lifetime of the worker since the Quran
text never changes — this keeps the app fast and polite to the upstream.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx


ALQURAN_BASE = "https://api.alquran.cloud/v1"
# Editions we expose. "en" = English translation (Sahih International),
# "bn" = Bengali (Taisirul Quran by Hai). Add more as needed.
DEFAULT_EDITIONS = ("quran-uthmani", "en.sahih", "bn.bengali")

# In-process TTL cache. Values: Dict[cache_key, (timestamp, payload)]
_CACHE: Dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SECONDS = 24 * 60 * 60  # 24h — Quran text is immutable


def _cache_get(key: str) -> Any | None:
    import time
    entry = _CACHE.get(key)
    if entry is None:
        return None
    ts, value = entry
    if (time.time() - ts) > _CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    import time
    _CACHE[key] = (time.time(), value)


async def _get_json(path: str, params: Optional[dict] = None) -> dict:
    """GET an AlQuran.cloud endpoint, raise on non-2xx, return parsed JSON."""
    url = f"{ALQURAN_BASE}{path}"
    cache_key = f"{url}?{sorted((params or {}).items())}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params or {})
        response.raise_for_status()
        data = response.json()

    if data.get("code") != 200:
        raise RuntimeError(f"AlQuran returned non-200 for {path}: {data}")

    _cache_set(cache_key, data)
    return data


async def get_surahs() -> List[Dict[str, Any]]:
    """Return all 114 Surahs (metadata only, no Ayah text)."""
    data = await _get_json("/surah")
    surahs: List[Dict[str, Any]] = []
    for s in data["data"]:
        surahs.append(
            {
                "number": s["number"],
                "name": s["name"],                 # Arabic name
                "englishName": s["englishName"],
                "englishNameTranslation": s.get("englishNameTranslation"),
                "numberOfAyahs": s["numberOfAyahs"],
                "revelationType": s["revelationType"],
            }
        )
    return surahs


async def get_surah_with_ayahs(
    surah_number: int,
    editions: tuple[str, ...] = DEFAULT_EDITIONS,
) -> Dict[str, Any]:
    """Return one Surah with all Ayahs across the requested editions.

    The response shape mirrors what the frontend expects:
        {surah_number, surah_name, english_name, ayahs: [{number, text, en, bn, ...}]}
    """
    edition_csv = ",".join(editions)
    data = await _get_json(f"/surah/{surah_number}/editions/{edition_csv}")

    # data["data"] is a list — one entry per edition, in the order requested.
    by_edition: Dict[str, dict] = {}
    for edition_payload in data["data"]:
        by_edition[edition_payload["edition"]["identifier"]] = edition_payload

    arabic_payload = by_edition.get("quran-uthmani", {})
    english_payload = by_edition.get("en.sahih", {})
    bengali_payload = by_edition.get("bn.bengali", {})

    arabic = arabic_payload.get("ayahs", [])
    english = english_payload.get("ayahs", [])
    bengali = bengali_payload.get("ayahs", [])

    # Surah metadata is identical in every edition; pick the first non-empty one.
    meta = (
        arabic_payload.get("surah")
        or english_payload.get("surah")
        or bengali_payload.get("surah")
        or {}
    )
    ayahs = []
    for i, ar in enumerate(arabic):
        ayahs.append(
            {
                "number": ar["number"],
                "numberInSurah": ar["numberInSurah"],
                "juz": ar.get("juz"),
                "page": ar.get("page"),
                "text": ar["text"],
                "translation": english[i]["text"] if i < len(english) else None,
                "bengali": bengali[i]["text"] if i < len(bengali) else None,
            }
        )

    return {
        "surah_number": surah_number,
        "surah_name": meta.get("name"),
        "english_name": meta.get("englishName"),
        "revelation_type": meta.get("revelationType"),
        "number_of_ayahs": meta.get("numberOfAyahs"),
        "ayahs": ayahs,
    }


async def get_ayah(
    surah_number: int,
    ayah_number: int,
    editions: tuple[str, ...] = DEFAULT_EDITIONS,
) -> Dict[str, Any]:
    """Return one Ayah across the requested editions."""
    edition_csv = ",".join(editions)
    data = await _get_json(f"/ayah/{surah_number}:{ayah_number}/editions/{edition_csv}")

    by_edition: Dict[str, dict] = {}
    for edition_payload in data["data"]:
        by_edition[edition_payload["edition"]["identifier"]] = edition_payload

    ar_payload = by_edition.get("quran-uthmani", {}) or {}
    en_payload = by_edition.get("en.sahih", {}) or {}
    bn_payload = by_edition.get("bn.bengali", {}) or {}

    # For single ayah, the payload itself is the ayah (no nested "ayah" key).
    ar = ar_payload
    en = en_payload
    bn = bn_payload

    surah_obj = ar.get("surah") or en.get("surah") or bn.get("surah") or {}

    return {
        "number": ar.get("number") or en.get("number"),
        "surah": surah_obj.get("number") if isinstance(surah_obj, dict) else None,
        "numberInSurah": ar.get("numberInSurah") or en.get("numberInSurah"),
        "text": ar.get("text"),
        "translation": en.get("text"),
        "bengali": bn.get("text"),
    }


async def search(query: str, edition: str = "en.sahih", limit: int = 20) -> Dict[str, Any]:
    """Search the Quran text in a given edition (best-effort, no relevance score)."""
    if not query or len(query.strip()) < 3:
        return {"query": query, "results": [], "total": 0}

    # /search/<keyword>/<edition>/<surah> — AlQuran supports a keyword search.
    data = await _get_json(f"/search/{query.strip()}/all/{edition}")
    matches = data.get("data", {}).get("matches", [])[:limit]
    results = [
        {
            "surah": m.get("surah", {}).get("number"),
            "ayah": m.get("numberInSurah"),
            "text": m.get("text"),
            "surah_english_name": m.get("surah", {}).get("englishName"),
        }
        for m in matches
    ]
    return {"query": query, "results": results, "total": len(results)}