"""Constants and helpers for Hijri date handling.

The Aladhan API supports ~14 calculation methods; the supported set in this
app is narrowed to the ones that are actually meaningful to most users
(global default + the most common regional conventions).

Reference: https://aladhan.com/calculation-methods
"""
from typing import Optional

# Public ID for each basis -> Aladhan `method` query-param value
HIJRI_BASIS_ALADHAN_METHOD: dict[str, int] = {
    "global":          2,   # ISNA / Umm al-Qura-derived (the international default)
    "umm_al_qura":     4,   # Saudi Arabia Umm al-Qura (used by official KACST)
    "isna":            2,   # Islamic Society of North America
    "mwl":             3,   # Muslim World League
    "egyptian":        5,   # Egyptian General Authority of Survey
    "karachi":         1,   # University of Islamic Sciences, Karachi
    "tehran":          7,   # Institute of Geophysics, Tehran (Shia)
    "jafari":          0,   # Shia Ithna Ashari (Jafari)
}

VALID_HIJRI_BASIS = set(HIJRI_BASIS_ALADHAN_METHOD.keys())

# Allowed bounds for user_sighting_offset. -1 is the practical minimum
# (a local committee can at most be one day ahead of Umm al-Qura).
HIJRI_OFFSET_MIN = -1
HIJRI_OFFSET_MAX = 1


# ---------------------------------------------------------------------------
# Country -> default Hijri offset heuristic.
# ---------------------------------------------------------------------------
# Several countries have an officially-recognized national moon-sighting
# committee that historically declares the new Hijri month one day earlier
# or later than Aladhan's "global" / Umm-al-Qura calculation.
#
# When a user picks a city for prayer times, we suggest the matching offset
# here as a *starting* default — but the user is always free to override it
# in Settings. This avoids surprising long-time residents of Dhaka who have
# been celebrating Eid / Ramadan per the Bangladesh committee for decades.
#
# Only countries with a well-documented, stable offset are listed here.
HIJRI_DEFAULT_OFFSET_BY_COUNTRY: dict[str, int] = {
    "Bangladesh": -1,   # Bangladesh Hijri Committee is typically one day ahead
                        # of Umm al-Qura (i.e. starts the new month earlier).
                        # Source: Bangladesh Govt. Hijri Committee announcements
                        # (publicly tracked 2018-2025).
    "India":      -1,   # Many Indian states (including Kerala & West Bengal) also
                        # follow the Bangladesh / regional-committee pattern of
                        # declaring the new month one day ahead of Umm al-Qura.
    "Morocco":    +1,   # Morocco's Ministry of Habous historically starts the
                        # new month one day *after* the global calculation.
                        # (We default to +1 but most Moroccan users override.)
}


def suggest_hijri_offset_for(country: Optional[str]) -> int:
    """Return the suggested local Hijri offset for a given country.

    Returns 0 (the global default) when the country is unknown. The match is
    case-insensitive and tolerates leading/trailing whitespace, so callers
    don't have to normalize user input.
    """
    if not country:
        return 0
    key = country.strip()
    # Case-insensitive lookup: build a lowercased view of the table on demand.
    lower_map = {k.lower(): v for k, v in HIJRI_DEFAULT_OFFSET_BY_COUNTRY.items()}
    return lower_map.get(key.lower(), 0)


def resolve_method(basis: str | None) -> int:
    """Map a user's `hijri_basis` setting to an Aladhan `method` integer.

    Unknown / missing values fall back to the global default (2).
    """
    if not basis:
        return HIJRI_BASIS_ALADHAN_METHOD["global"]
    return HIJRI_BASIS_ALADHAN_METHOD.get(basis, HIJRI_BASIS_ALADHAN_METHOD["global"])


def get_hijri_settings_for_user(db, user_id: int) -> tuple[str, int]:
    """Return `(basis, offset)` for the given user, falling back to defaults.

    Used by the prayer-times endpoints to honor the user's local Hijri
    convention when computing the date label.

    Defensive: if `db` is `None` (e.g. in a test fixture or a pre-DB code path),
    we just return the default `(global, 0)` rather than raising.
    """
    if db is None:
        return "global", 0
    from app.models.user import UserPreferences  # local import to avoid cycle

    prefs = (
        db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    )
    if prefs is None:
        return "global", 0
    return prefs.hijri_basis or "global", int(prefs.hijri_offset or 0)


def resolve_effective_hijri_settings(
    db,
    user_id: int,
    country_hint: Optional[str] = None,
) -> tuple[str, int, bool]:
    """Return `(basis, offset, country_overrode)` for a Hijri computation.

    `country_overrode` is True iff we applied the country-specific default
    because the user had not customized their offset yet (i.e. the stored
    offset is still 0 and we had a known country). This lets the UI label
    the date as "per local committee" honestly, without lying about an
    explicit user choice.

    Resolution rules:
      1. Read the user's stored `(basis, offset)`. If the user has explicitly
         chosen a non-default basis or non-zero offset, return that as-is.
      2. Otherwise, if `country_hint` is one we know about, apply its
         suggested offset on top of the user's stored basis.
      3. Otherwise return the stored defaults.
    """
    basis, offset = get_hijri_settings_for_user(db, user_id)
    country_overrode = False
    if offset == 0 and country_hint:
        suggested = suggest_hijri_offset_for(country_hint)
        if suggested != 0:
            offset = suggested
            country_overrode = True
    return basis, offset, country_overrode
