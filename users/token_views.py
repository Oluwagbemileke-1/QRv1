from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings

User = get_user_model()


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not getattr(self.user, "is_verified", False):
            raise AuthenticationFailed("Email not verified")
        return data


class VerifiedTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user_id = refresh.get(api_settings.USER_ID_CLAIM)
        user = User.objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()
        if not user or not getattr(user, "is_verified", False) or not getattr(user, "is_active", False):
            raise AuthenticationFailed("Email not verified")
        return super().validate(attrs)


class VerifiedTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedTokenObtainPairSerializer


class VerifiedTokenRefreshView(TokenRefreshView):
    serializer_class = VerifiedTokenRefreshSerializer
