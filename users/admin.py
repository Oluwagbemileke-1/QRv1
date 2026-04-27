from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, PasswordResetOTP, EmailVerification, ChangeEmailVerification


class CustomUserAdmin(UserAdmin):
    list_display = (
        'username',
        'email',
        'first_name',
        'last_name',
        'phone',
        'account_type',
        'is_staff',
        'id',
    )
    ordering = ('username',)
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email', 'phone', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    def account_type(self, obj):
        return obj.display_role

    account_type.short_description = "Account Type"


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

    def is_active_display(self, obj):
        if obj.is_expired():
            return "Expired"
        return "Active"

    is_active_display.short_description = "Status"

    def time_left_display(self, obj):
        return f"{obj.time_left()}s left"

    time_left_display.short_description = "Time Left"


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'is_verified',
        'used',
        'time_left_display',
        'created_at',
    )
    list_filter = ('is_verified', 'used', 'created_at')
    search_fields = ('user__username', 'user__email')
    ordering = ('-created_at',)
    readonly_fields = ('token_hash', 'created_at', 'time_left_display')

    def time_left_display(self, obj):
        return f"{obj.time_left()}s left"

    time_left_display.short_description = "Time Left"


@admin.register(ChangeEmailVerification)
class ChangeEmailVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'new_email',
        'is_verified',
        'used',
        'time_left_display',
        'created_at',
    )
    list_filter = ('is_verified', 'used', 'created_at')
    search_fields = ('user__username', 'user__email', 'new_email')
    ordering = ('-created_at',)
    readonly_fields = ('token_hash', 'created_at', 'time_left_display')

    def time_left_display(self, obj):
        return f"{obj.time_left()}s left"

    time_left_display.short_description = "Time Left"
