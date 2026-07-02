"""Tests for the prayer-times endpoints.

External HTTP calls (Aladhan) are mocked at the httpx level so these run
offline and don't count against Aladhan's rate limits.
"""
from unittest.mock import patch, AsyncMock

FAKE_ALADHAN_TODAY = {
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
        "date": {"hijri": {"date": "15-10-1447"}},
    },
}


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_today_prayer_times_city(mock_get, client, auth_headers):
    mock_get.return_value.json.return_value = FAKE_ALADHAN_TODAY
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/today?city=Dhaka&country=Bangladesh",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["prayers"]["fajr"] == "04:00"
    assert "Dhaka" in data["location"]


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_prayer_times_requires_auth(mock_get, client):
    mock_get.return_value.json.return_value = FAKE_ALADHAN_TODAY
    r = client.get("/api/v1/prayer-times/today")
    assert r.status_code == 401


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_city_endpoint_returns_200_for_dhaka(mock_get, client, auth_headers):
    """Regression test for the /prayer-times/city 500.

    Every endpoint that calls `_apply_user_hijri` must unpack the new 4-tuple
    `(friendly, compact, basis, offset)`; this guards the `/city` route which
    previously crashed with a 500 because it still expected a 2-tuple.
    """
    mock_get.return_value.json.return_value = {
        "code": 200,
        "data": {
            "timings": {
                "Fajr": "04:00",
                "Sunrise": "05:12",
                "Dhuhr": "12:00",
                "Asr": "15:18",
                "Sunset": "18:48",
                "Maghrib": "18:48",
                "Isha": "20:00",
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
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/city?city=Dhaka&country=Bangladesh",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "Dhaka" in data["location"]
    # New tuple fields must be present so the UI can label the source.
    assert "hijri_basis" in data
    assert "hijri_offset_applied" in data


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_date_endpoint_returns_200(mock_get, client, auth_headers):
    """Regression: /date/{date} also calls _apply_user_hijri."""
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
                    "month": {"en": "Muharram", "number": 1},
                    "year": "1448",
                }
            },
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/date/2026-06-20?city=Dhaka&country=Bangladesh",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "hijri_basis" in data
    assert "hijri_offset_applied" in data


@patch("app.api.v1.endpoints.prayer_times.requests.get")
def test_location_endpoint_returns_200(mock_get, client, auth_headers):
    """Regression: /location also calls _apply_user_hijri."""
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
                    "month": {"en": "Muharram", "number": 1},
                    "year": "1448",
                }
            },
        },
    }
    mock_get.return_value.raise_for_status = lambda: None

    r = client.get(
        "/api/v1/prayer-times/location?latitude=23.81&longitude=90.41",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["latitude"] == 23.81
    assert "hijri_basis" in data
    assert "hijri_offset_applied" in data