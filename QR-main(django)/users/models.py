from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
# Create your models here.
class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('user', 'User'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')  # adds a role field to the user model, allowing us to differentiate between admin and regular users
    phone = models.CharField(max_length=15, unique=True,  blank=True, null=True) 
    # def save(self, *args, **kwargs):
    #     # Auto set staff status based on role
    #     self.is_staff = True if self.role == 'admin' else False
    #     super().save(*args, **kwargs)

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = 'admin'
        super().save(*args, **kwargs)

    def __str__(self):
          return f"{self.first_name} {self.last_name}"
    

class PasswordResetOTP(models.Model):
     user = models.ForeignKey(User, on_delete=models.CASCADE)
     otp = models.CharField(max_length=128)
     is_verified = models.BooleanField(default=False)
     created_at = models.DateTimeField(auto_now_add=True)
     used = models.BooleanField(default=False)
     
     def set_otp(self, raw_otp):
        self.otp = make_password(raw_otp)

     def check_otp(self, raw_otp):
        return check_password(raw_otp, self.otp)
    
     def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=10)
     
     def time_left(self):
         expiry_time = self.created_at + timedelta(minutes=10)
         remaining = expiry_time - timezone.now()
         return max(0, int(remaining.total_seconds()))
     
     def __str__(self):
          return f"{self.user} -  verified: {self.is_verified}"
     

     
     