from django.urls import path
from .views import resend_email

urlpatterns = [
    path("email/<id>/resend/", resend_email),
]