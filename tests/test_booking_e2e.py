import json
import os
import unittest
import uuid
from datetime import date, timedelta
from urllib import error, parse, request


BASE_URL = os.getenv("BOOKING_E2E_BASE_URL", "http://localhost:3000")
TIMEOUT = float(os.getenv("BOOKING_E2E_TIMEOUT", "10"))


class BookingEndToEndTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._assert_gateway_is_reachable()

        cls.suffix = uuid.uuid4().hex[:8]
        cls.password = "Test1234!"
        cls.owner_username = f"owner_{cls.suffix}"
        cls.tenant_username = f"tenant_{cls.suffix}"
        cls.city = f"Paris-{cls.suffix}"

        cls.owner = cls._register_user(cls.owner_username)
        cls.tenant = cls._register_user(cls.tenant_username)
        cls.owner_token = cls.owner["token"]
        cls.tenant_token = cls.tenant["token"]

        cls._api("POST", "/auth/become-owner", token=cls.owner_token, expected=200)

        cls.property = cls._create_property()
        cls.property_id = cls.property["id"]

        cls.blocked_date = date.today() + timedelta(days=10)
        cls.booking1_check_in = date.today() + timedelta(days=12)
        cls.booking1_check_out = date.today() + timedelta(days=14)
        cls.booking2_check_in = date.today() + timedelta(days=20)
        cls.booking2_check_out = date.today() + timedelta(days=22)

        cls._set_blocked_date(cls.blocked_date)

    @classmethod
    def tearDownClass(cls):
        for token in (getattr(cls, "owner_token", None), getattr(cls, "tenant_token", None)):
            if not token:
                continue
            try:
                cls._api("POST", "/auth/logout", token=token, expected=200)
            except Exception:
                pass

    def test_booking_rules_end_to_end(self):
        config = self._api("GET", "/bookings/config", expected=200)
        self.assertTrue(config["success"])
        self.assertIn("booking_statuses", config["data"])

        booking_properties = self._api("GET", "/bookings/properties", expected=200)
        self.assertTrue(booking_properties["success"])
        self.assertTrue(any(prop["id"] == self.property_id for prop in booking_properties["data"]))

        self_book = self._api(
            "POST",
            "/bookings",
            token=self.owner_token,
            body={
                "property_id": self.property_id,
                "check_in": self.booking1_check_in.isoformat(),
                "check_out": self.booking1_check_out.isoformat(),
            },
            expected=400,
        )
        self.assertEqual(self_book["error"]["code"], "SELF_BOOKING_NOT_ALLOWED")

        blocked_booking = self._api(
            "POST",
            "/bookings",
            token=self.tenant_token,
            body={
                "property_id": self.property_id,
                "check_in": self.blocked_date.isoformat(),
                "check_out": (self.blocked_date + timedelta(days=1)).isoformat(),
            },
            expected=409,
        )
        self.assertEqual(blocked_booking["error"]["code"], "DATE_UNAVAILABLE")

        booking1 = self._api(
            "POST",
            "/bookings",
            token=self.tenant_token,
            body={
                "property_id": self.property_id,
                "check_in": self.booking1_check_in.isoformat(),
                "check_out": self.booking1_check_out.isoformat(),
            },
            expected=201,
        )
        self.assertTrue(booking1["success"])
        self.assertEqual(booking1["data"]["status"], "pending")
        booking1_id = booking1["data"]["id"]

        search_while_booked = self._api(
            "GET",
            "/search",
            params={
                "city": self.city,
                "check_in": self.booking1_check_in.isoformat(),
                "check_out": self.booking1_check_out.isoformat(),
            },
            expected=200,
        )
        self.assertTrue(all(prop["id"] != self.property_id for prop in search_while_booked))

        tenant_bookings = self._api("GET", "/bookings", token=self.tenant_token, expected=200)
        self.assertTrue(any(booking["id"] == booking1_id for booking in tenant_bookings["data"]))

        owner_bookings = self._api("GET", "/bookings", token=self.owner_token, expected=200)
        self.assertTrue(any(booking["id"] == booking1_id for booking in owner_bookings["data"]))

        booking1_detail = self._api("GET", f"/bookings/{booking1_id}", token=self.tenant_token, expected=200)
        self.assertEqual(booking1_detail["data"]["id"], booking1_id)

        booking1_accepted = self._api(
            "PATCH",
            f"/bookings/{booking1_id}/status",
            token=self.owner_token,
            body={"status": "accepted"},
            expected=200,
        )
        self.assertEqual(booking1_accepted["data"]["status"], "accepted")

        booking1_paid = self._api(
            "PATCH",
            f"/bookings/{booking1_id}/status",
            token=self.tenant_token,
            body={"status": "paid"},
            expected=200,
        )
        self.assertEqual(booking1_paid["data"]["status"], "paid")

        paid_cancel = self._api(
            "DELETE",
            f"/bookings/{booking1_id}",
            token=self.tenant_token,
            expected=400,
        )
        self.assertEqual(paid_cancel["error"]["code"], "CANNOT_CANCEL_PAID")

        review = self._api(
            "POST",
            f"/bookings/{booking1_id}/reviews",
            token=self.tenant_token,
            body={
                "target_type": "property",
                "reviewed_id": self.property_id,
                "rating": 5,
                "comment": "Excellent sejour pour test E2E",
            },
            expected=201,
        )
        self.assertTrue(review["success"])
        review_id = review["data"]["id"]

        tenant_reviews = self._api(
            "GET",
            f"/bookings/{booking1_id}/reviews",
            token=self.tenant_token,
            expected=200,
        )
        self.assertTrue(any(current_review["id"] == review_id for current_review in tenant_reviews["data"]))

        owner_reviews = self._api(
            "GET",
            f"/bookings/{booking1_id}/reviews",
            token=self.owner_token,
            expected=200,
        )
        self.assertTrue(any(current_review["id"] == review_id for current_review in owner_reviews["data"]))

        booking2 = self._api(
            "POST",
            "/bookings",
            token=self.tenant_token,
            body={
                "property_id": self.property_id,
                "check_in": self.booking2_check_in.isoformat(),
                "check_out": self.booking2_check_out.isoformat(),
            },
            expected=201,
        )
        self.assertEqual(booking2["data"]["status"], "pending")
        booking2_id = booking2["data"]["id"]

        cancelled_booking2 = self._api(
            "DELETE",
            f"/bookings/{booking2_id}",
            token=self.tenant_token,
            expected=200,
        )
        self.assertTrue(cancelled_booking2["success"])

        search_after_cancel = self._api(
            "GET",
            "/search",
            params={
                "city": self.city,
                "check_in": self.booking2_check_in.isoformat(),
                "check_out": self.booking2_check_out.isoformat(),
            },
            expected=200,
        )
        self.assertTrue(any(prop["id"] == self.property_id for prop in search_after_cancel))

        paid_bookings = self._api(
            "GET",
            "/bookings",
            token=self.tenant_token,
            params={"status": "paid"},
            expected=200,
        )
        self.assertTrue(any(booking["id"] == booking1_id for booking in paid_bookings["data"]))

        cancelled_bookings = self._api(
            "GET",
            "/bookings",
            token=self.tenant_token,
            params={"status": "cancelled"},
            expected=200,
        )
        self.assertTrue(any(booking["id"] == booking2_id for booking in cancelled_bookings["data"]))

    @classmethod
    def _assert_gateway_is_reachable(cls):
        try:
            payload = cls._api("GET", "/health", expected=200)
        except RuntimeError as exc:
            raise RuntimeError(
                f"Gateway inaccessible sur {BASE_URL}. Démarre la stack avec `docker compose up -d --build`."
            ) from exc

        if payload.get("status") != "ok":
            raise RuntimeError(f"Réponse /health inattendue: {payload}")

    @classmethod
    def _register_user(cls, username):
        return cls._api(
            "POST",
            "/auth/register",
            body={
                "username": username,
                "email": f"{username}@example.com",
                "password": cls.password,
                "confirm_password": cls.password,
            },
            expected=200,
        )

    @classmethod
    def _create_property(cls):
        payload = cls._api(
            "POST",
            "/catalog/properties",
            token=cls.owner_token,
            body={
                "title": f"Appartement E2E {cls.suffix}",
                "description": "Property for booking end-to-end tests",
                "city": cls.city,
                "address": f"Rue de Test {cls.suffix}",
                "latitude": 48.8566,
                "longitude": 2.3522,
                "price_per_night": 120.0,
                "num_rooms": 2,
                "amenities": "wifi,parking",
            },
            expected=200,
        )
        if payload["owner_id"] != cls.owner["id"]:
            raise AssertionError(f"owner_id inattendu sur la propriété créée: {payload}")
        return payload

    @classmethod
    def _set_blocked_date(cls, blocked_date):
        payload = cls._api(
            "POST",
            f"/catalog/properties/{cls.property_id}/availability",
            token=cls.owner_token,
            body={"date": blocked_date.isoformat(), "is_blocked": True},
            expected=200,
        )
        if payload["is_blocked"] is not True:
            raise AssertionError(f"la date n'a pas été bloquée correctement: {payload}")

    @staticmethod
    def _api(method, path, token=None, body=None, params=None, expected=None):
        query = f"?{parse.urlencode(params, doseq=True)}" if params else ""
        url = f"{BASE_URL}{path}{query}"

        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        else:
            data = None

        req = request.Request(url, data=data, headers=headers, method=method)

        try:
            with request.urlopen(req, timeout=TIMEOUT) as response:
                status = response.status
                raw_body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            try:
                status = exc.code
                raw_body = exc.read().decode("utf-8")
            finally:
                exc.close()
        except error.URLError as exc:
            raise RuntimeError(str(exc)) from exc

        payload = json.loads(raw_body) if raw_body else None

        if expected is not None and status != expected:
            raise AssertionError(
                f"{method} {path} attendu={expected} obtenu={status} payload={payload}"
            )

        return payload


if __name__ == "__main__":
    unittest.main()
