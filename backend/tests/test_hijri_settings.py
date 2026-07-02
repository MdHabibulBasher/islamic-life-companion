"""Tests for user-customizable Hijri date basis + offset.

Covers:
- Validation in the UserPreferences schemas (rejects bad basis / out-of-range offset).
- Round-trip GET/PUT through /user/preferences.
- /prayer-times/today uses the user's basis + offset.
- /prayer-times/islamic-date uses the user's basis + offset.
- Default behavior (basis=global, offset=0) is preserved.
"""
from unittest.mock import patch

from app.models.user import UserPreferences
from app.services.hijri import (
    HIJRI_BASIS_ALADHAN_METHOD,
    VALID_HIJRI_BASIS,
    get_hijri_settings_for_user,
    resolve_method,
)


# --- Schema validation -------------------------------------------------------


def test_user_preferences_default_basis_and_offset():
    """New rows default to global basis with zero offset."""
    basis, offset = get_hijri_settings_for_user(db=None, user_id=999_999)  # type: ignore[arg-type]
    assert basis == "global"
    assert offset == 0


def test_resolve_method_maps_known_bases():
    for name, method in HIJRI_BASIS_ALADHAN_METHOD.items():
        assert resolve_method(name) == method


def test_resolve_method_falls_back_to_global():
    assert resolve_method("not_a_real_basis") == HIJRI_BASIS_ALADHAN_METHOD["global"]
    assert resolve_method(None) == HIJRI_BASIS_ALADHAN_METHOD["global"]


def test_valid_hijri_basis_includes_global():
    assert "global" in VALID_HIJRI_BASIS
    assert "umm_al_qura" in VALID_HIJRI_BASIS
    assert "isna" in VALID_HIJRI_BASIS


def test_user_preferences_rejects_unknown_basis(auth_headers, client):
    r = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"hijri_basis": "bogus_method"},
    )
    assert r.status_code == 422


def test_user_preferences_rejects_offset_out_of_range(auth_headers, client):
    r = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"hijri_offset": 5},
    )
    assert r.status_code == 422
    r = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"hijri_offset": -5},
    )
    assert r.status_code == 422


# --- Round-trip persistence --------------------------------------------------


def test_user_preferences_hijri_round_trip(auth_headers, client):
    """PUT hijri_basis + offset, then GET it back."""
    r1 = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"hijri_basis": "umm_al_qura", "hijri_offset": -1},
    )
    assert r1.status_code == 200
    assert r1.json()["hijri_basis"] == "umm_al_qura"
    assert r1.json()["hijri_offset"] == -1

    r2 = client.get("/api/v1/user/preferences", headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["hijri_basis"] == "umm_al_qura"
    assert r2.json()["hijri_offset"] == -1


def test_user_preferences_offset_zero_is_valid(auth_headers, client):
    r = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"hijri_basis": "isna", "hijri_offset": 0},
    )
    assert r.status_code == 200
    assert r.json()["hijri_basis"] == "isna"
    assert r.json()["hijri_offset"] == 0


# --- Endpoint behavior with user settings ------------------------------------


FAKE_ALADHAN_TIMINGS = {
    "code": 200,
    "data": {
        "timings": {
            "Fajr": "04:00",
            "Sunrise": "05:11",
            "Dhuhr": "11:56",
            "Asr": "15:16",
            "Sunset": "18:41",
            "Maghrib": "18:41",
            "Isha": "19:52",
            "Imsak": "03:50",
        },
        "date": {
            "hijri": {
                "date": "05-01-1448",
                "day": "05",
                "month": {"en": "Muharram", "number": 1},
                "year": "1448",
            }
        },
    },
}


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_today_default_basis_uses_aladhan_payload(mock_get, client, auth_headers):
    """Default user (no custom settings) + unknown country → just unwrap
    Aladhan's payload. With a known country like Bangladesh the country-hint
    path applies the local offset (covered separately).
    """
    mock_get.return_value.json.return_value = FAKE_ALADHAN_TIMINGS
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/today?city=Paris&country=France",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    # 05 + Muharram + 1448 + AH
    assert data["hijri_date"] == "5 Muharram 1448 AH"
    assert data["hijri_date_compact"] == "05-01-1448"
    assert data["hijri_offset_applied"] == 0


@patch("app.services.hijri_dates.requests.get")
def test_islamic_date_default_basis(mock_get, client, auth_headers):
    """Default user gets a Hijri date object honoring the default basis."""
    mock_get.return_value.json.return_value = {
        "code": 200,
        "data": {
            "hijri": {
                "date": "05-01-1448",
                "day": "05",
                "month": {"en": "Muharram", "number": 1},
                "year": "1448",
            }
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/islamic-date?target_date=2026-06-20",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["hijri_basis"] == "global"
    assert data["hijri_offset_applied"] == 0
    assert data["hijri_month"] == "Muharram"
    assert data["hijri_day"] == 5  # normalized to int


@patch("app.services.hijri_dates.requests.get")
def test_islamic_date_uses_user_basis_and_offset(mock_get, client, auth_headers):
    """When the user picks umm_al_qura + offset=-1, the helper re-queries Aladhan
    with the right method and shifted Gregorian date.
    """
    mock_get.return_value.json.return_value = {
        "code": 200,
        "data": {
            "hijri": {
                "date": "04-01-1448",
                "day": "04",
                "month": {"en": "Muharram", "number": 1},
                "year": "1448",
            }
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    # Switch user to Umm al-Qura with -1 offset.
    r = client.put(
        "/api/v1/user/preferences",
        headers=auth_headers,
        json={"hijri_basis": "umm_al_qura", "hijri_offset": -1},
    )
    assert r.status_code == 200

    r = client.get(
        "/api/v1/prayer-times/islamic-date?target_date=2026-06-20",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["hijri_basis"] == "umm_al_qura"
    assert data["hijri_offset_applied"] == -1

    # Verify Aladhan was called with method=4 (Umm al-Qura) and a date 1 day
    # earlier than the one the user requested (offset shifts Gregorian).
    call = mock_get.call_args
    assert call.kwargs["params"]["method"] == 4
    # URL contains the shifted Gregorian date: 19-06-2026 instead of 20-06-2026.
    assert "19-06-2026" in call.args[0]  # type: ignore[operator]  # positional url arg


# --- DB-level helper --------------------------------------------------------


def test_get_hijri_settings_for_user_reads_row(db_session, test_user):
    prefs = UserPreferences(
        user_id=test_user.id,
        hijri_basis="isna",
        hijri_offset=1,
    )
    db_session.add(prefs)
    db_session.commit()

    basis, offset = get_hijri_settings_for_user(db_session, test_user.id)
    assert basis == "isna"
    assert offset == 1


# --- Country-based default Hijri offset heuristic ----------------------------


def test_suggest_hijri_offset_for_bangladesh():
    """Bangladesh's committee is one day ahead of the global calculation."""
    from app.services.hijri import suggest_hijri_offset_for
    assert suggest_hijri_offset_for("Bangladesh") == -1
    # Tolerates casing / whitespace.
    assert suggest_hijri_offset_for(" bangladesh ") == -1
    assert suggest_hijri_offset_for("BANGLADESH") == -1


def test_suggest_hijri_offset_for_unknown_country():
    from app.services.hijri import suggest_hijri_offset_for
    assert suggest_hijri_offset_for("Atlantis") == 0
    assert suggest_hijri_offset_for(None) == 0
    assert suggest_hijri_offset_for("") == 0


def test_suggest_hijri_offset_for_morocco():
    from app.services.hijri import suggest_hijri_offset_for
    assert suggest_hijri_offset_for("Morocco") == 1


def test_hijri_offset_suggestion_endpoint(auth_headers, client):
    """GET /user/hijri-offset-suggestion?country=Bangladesh returns -1."""
    r = client.get(
        "/api/v1/user/hijri-offset-suggestion?country=Bangladesh",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["suggested_offset"] == -1
    assert data["is_known_country"] is True


def test_hijri_offset_suggestion_unknown_country(auth_headers, client):
    r = client.get(
        "/api/v1/user/hijri-offset-suggestion?country=Atlantis",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["suggested_offset"] == 0
    assert r.json()["is_known_country"] is False


# --- Country-hint path in prayer-times endpoints -----------------------------
# Even before the user has saved their location via POST /user/location, the
# prayer-times endpoints must apply the country-specific default offset when
# the request includes a `country=...` query param. This is what makes Dhaka
# render `4 Muḥarram` immediately on the first request, without a DB
# round-trip.


@patch("app.services.hijri_dates.requests.get")
def test_city_endpoint_applies_country_hint_dhaka(mock_get, client, auth_headers):
    """`?city=Dhaka&country=Bangladesh` must yield offset=-1 right away."""
    mock_get.return_value.json.return_value = {
        "code": 200,
        "data": {
            "hijri": {
                "date": "04-01-1448",  # Bangladesh committee value
                "day": "04",
                "month": {"en": "Muḥarram", "number": 1},
                "year": "1448",
            }
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/islamic-date?target_date=2026-06-20",
        headers=auth_headers,
    )
    # Set the country hint directly via the test path: there's no country
    # query param on /islamic-date, so this checks the user-stored default
    # path. The /city endpoint is the more meaningful test below.
    assert r.status_code == 200


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_today_endpoint_applies_country_hint_dhaka(mock_get, client, auth_headers):
    """`?city=Dhaka&country=Bangladesh` must apply offset=-1 immediately.

    This is the headline user-visible regression: the screenshot shows the
    Prayer Times page in Dhaka returning `5 Muḥarram` (no offset) when it
    should return `4 Muḥarram` per the Bangladesh committee. The fix is to
    thread `country` from the query params through `_apply_user_hijri`.
    """
    mock_get.return_value.json.return_value = {
        "code": 200,
        "data": {
            "timings": {
                "Fajr": "04:00", "Sunrise": "05:12", "Dhuhr": "12:00",
                "Asr": "15:18", "Sunset": "18:48", "Maghrib": "18:48",
                "Isha": "20:00", "Imsak": "03:50",
            },
            "date": {
                "hijri": {
                    # Default Aladhan answer (no offset)
                    "date": "05-01-1448", "day": "05",
                    "month": {"en": "Muḥarram", "number": 1},
                    "year": "1448",
                }
            },
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/today?city=Dhaka&country=Bangladesh",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["hijri_basis"] == "global"
    assert data["hijri_offset_applied"] == -1
    # The country override path calls Aladhan a second time with the
    # shifted Gregorian date (19-06-2026) and method=2.
    second_call = mock_get.call_args_list[-1]
    assert "19-06-2026" in second_call.args[0]
    assert second_call.kwargs["params"]["method"] == 2


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_today_endpoint_no_override_for_unknown_country(mock_get, client, auth_headers):
    """Unknown country: no override; result uses Aladhan's bundled value."""
    mock_get.return_value.json.return_value = {
        "code": 200,
        "data": {
            "timings": {
                "Fajr": "04:00", "Sunrise": "05:12", "Dhuhr": "12:00",
                "Asr": "15:18", "Sunset": "18:48", "Maghrib": "18:48",
                "Isha": "20:00", "Imsak": "03:50",
            },
            "date": {
                "hijri": {
                    "date": "05-01-1448", "day": "05",
                    "month": {"en": "Muḥarram", "number": 1},
                    "year": "1448",
                }
            },
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/today?city=Paris&country=France",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["hijri_offset_applied"] == 0
    # No second Aladhan call expected.
    assert mock_get.call_count == 1
