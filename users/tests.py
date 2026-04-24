from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class UserEmailChangeFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="StrongPass123!",
            first_name="Test",
            last_name="User",
            is_active=True,
            is_verified=True,
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_email_change_updates_email_without_deactivating_user(self):
        response = self.client.put(
            reverse("update_user", kwargs={"id": self.user.id}),
            {"email": "new@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()

        self.assertEqual(self.user.email, "new@example.com")
        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.is_verified)
        self.assertFalse(response.data["email_verification_required"])
