from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_event, name='create_event'),
    path('', views.list_events, name='list_events'),
    path('my-events/', views.my_events, name='my_events'),
    path('<uuid:id>/', views.event_detail, name='event_detail'),
    path('<uuid:id>/update/', views.update_event, name='update_event'),
    path('<uuid:id>/delete/', views.delete_event, name='delete_event'),
    path('<uuid:event_id>/assign/', views.assign, name='assign'),
    path('<uuid:event_id>/eventattendees/', views.event_attendees, name='event_attendees'),
    path('allevents/', views.allevents, name='allevents')
    
]

