from django.urls import path
from . import views

urlpatterns = [
    path('check-in/', views.check_in, name='check-in'),
    path('my-attendance/', views.my_attendance, name='my-attendance'),
    path('admin-dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('<uuid:event_id>/live-count/', views.live_attendance, name='live-attendance'),
]