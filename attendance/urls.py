from django.urls import path
from . import views

urlpatterns = [
    path('check-in/', views.check_in, name='check-in'),
    path('my-attendance/', views.my_attendance, name='my-attendance'),
    path('admin-dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('<uuid:event_id>/live-count/', views.live_attendance, name='live-attendance'),
    path('<uuid:event_id>/my-event-attendance/', views.my_event_attendance, name='my-event-attendace'),
    path('<uuid:event_id>/event-dashboard/', views.event_dashboard, name='event-dashboard'),
    path('<uuid:event_id>/event-attendance-admin/', views.event_attendance_admin, name='event-attendance-admin'),
    path('<uuid:event_id>/event-csv/', views.export_event_csv, name='event-csv'),
    path('<uuid:event_id>/event-pdf/', views.export_event_pdf, name='event-pdf'),
    path('week-csv/', views.export_this_week_csv, name='week-csv'),
    path('week-pdf/', views.export_this_week_pdf, name='week-pdf'),
    path('range/csv/', views.export_custom_range_csv),
    path('range/pdf/', views.export_custom_range_pdf),
]