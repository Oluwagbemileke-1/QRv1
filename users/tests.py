from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class VerificationSecurityTests(APITestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.verified_user = User.objects.create_user(
            username="verifieduser",
            email="verified@example.com",
            password=self.password,
            is_active=True,
            is_verified=True,
        )
        self.unverified_user = User.objects.create_user(
            username="pendinguser",
            email="pending@example.com",
            password=self.password,
            is_active=False,
            is_verified=False,
        )

    def test_unverified_custom_login_is_blocked(self):
        response = self.client.post(
            reverse("login"),
            {"username": self.unverified_user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"], "Email not verified")

    def test_unverified_simplejwt_token_obtain_is_blocked(self):
        response = self.client.post(
            "/api/token/",
            {"username": self.unverified_user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unverified_simplejwt_refresh_is_blocked(self):
        refresh = RefreshToken.for_user(self.unverified_user)
        response = self.client.post(
            "/api/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unverified_forgot_password_is_blocked(self):
        response = self.client.post(
            reverse("forgot_password"),
            {"identifier": self.unverified_user.email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["message"], "Email not verified")

    def test_unverified_resend_otp_is_blocked(self):
        response = self.client.post(
            reverse("resend_otp"),
            {"identifier": self.unverified_user.email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["message"], "Email not verified")

    def test_verified_user_can_get_simplejwt_token(self):
        response = self.client.post(
            "/api/token/",
            {"username": self.verified_user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_verified_user_can_start_forgot_password(self):
        response = self.client.post(
            reverse("forgot_password"),
            {"identifier": self.verified_user.email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
