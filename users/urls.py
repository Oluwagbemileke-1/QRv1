from django.urls import path
from . import views

urlpatterns = [
     path('register/', views.register, name='register'), # post
     path('resendemail/', views.resend_verification, name='resend-verification'), # post
     path('verify-email/confirm/', views.verify_email_confirm, name='verify-email-confirm'),
     path('change-email/confirm/', views.verify_change_email_confirm, name='verify-change-email-confirm'),
     path('change-email/resend/', views.resend_change_email_verification, name='resend-change-email'),
     path('change-email/<str:token>/', views.verify_change_email, name='verify-change-email'),
     path('verify-email/<str:token>/', views.verify_email, name='verify-email'),
     path('login/', views.login, name='login'), # post
     path('logout/', views.logout, name='logout'), # post
     path('list/', views.users_list, name='users_list'), # get 
     path('<int:id>/', views.user_detail, name='user_detail'), # get
     path('<int:id>/update/', views.update_user, name='update_user'), # put
     path('<int:id>/delete/', views.delete_user, name='delete_user'), # delete
     path('change-password/', views.change_password, name='change_password'), # put
     path('forgot-password/', views.forgot_password, name='forgot_password'), # post
     path('verify-otp/', views.verify_otp, name='verify_otp'), # post
     path('reset-password/', views.reset_password, name='reset_password'), # post
     path('resend-otp/', views.resend_otp, name='resend_otp'), # post
]
