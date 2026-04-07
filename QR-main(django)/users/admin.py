from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, PasswordResetOTP
# Register your models here.


class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'phone', 'role', 'is_staff', 'id')
    ordering = ('username',)
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email', 'phone', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    # add_fieldsets = (
    #     (None, {
    #         'fields': ('username', 'first_name', 'last_name', 'email', 'phone', 'role', 'password1', 'password2'),
    #     }),
    # )

admin.site.register(User, CustomUserAdmin)


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):

    list_display = (
        'user',
        'is_verified',
        'used',
        'is_active_display',
        'time_left_display',
        'created_at',
    )

    list_filter = (
        'is_verified',
        'used',
        'created_at',
    )

    search_fields = (
        'user__username',
        'user__email',
        'user__phone',
    )

    ordering = ('-created_at',)

    readonly_fields = (
        'otp',
        'created_at',
        'time_left_display',
    )

    # 🔥 show if OTP is still valid
    def is_active_display(self, obj):
        if obj.is_expired():
            return "❌ Expired"
        return "✅ Active"
    is_active_display.short_description = "Status"

    # 🔥 countdown timer
    def time_left_display(self, obj):
        return f"{obj.time_left()}s left"
    time_left_display.short_description = "Time Left"