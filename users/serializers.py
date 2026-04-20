from rest_framework import serializers
from .models import User,PasswordResetOTP
from django.contrib.auth.password_validation import validate_password
from rest_framework.validators import UniqueValidator
from django.db.models import Q

class RegisterSerializer(serializers.ModelSerializer):
    # Username already exists
    username = serializers.CharField(
        # validators=[UniqueValidator(queryset=User.objects.all(), message="Username already exists.")]
    )

    # Email already exists
    email = serializers.EmailField(
        # validators=[UniqueValidator(queryset=User.objects.all(), message="Email already exists.")]
    )

    # phone number already exists

    
    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name','phone', 'password', 'password2') # remove role from fields, we will set it to 'user' by default in the create method to prevent users from assigning themselves admin roles

    def validate(self, data):
        username = data.get("username")
        email = data.get("email")
        phone = data.get("phone")

        # Only block if VERIFIED user exists
        if User.objects.filter(username=username, is_verified=True).exists():
            raise serializers.ValidationError({"username": "Username already exists."})

        if User.objects.filter(email=email, is_verified=True).exists():
            raise serializers.ValidationError({"email": "Email already exists."})

        if phone and User.objects.filter(phone=phone, is_verified=True).exists():
            raise serializers.ValidationError({"phone": "Phone number already exists."})

        if data.get("password") != data.get("password2"):
            raise serializers.ValidationError({"password": "Passwords do not match."})

        return data
    
    def create(self, validated_data):
        # Remove password2, we don't save it
        validated_data.pop('password2')

        # Extract password
        password = validated_data.pop('password') # Remove password from validated_data to avoid saving it as a plain field (temporarily)
        email = validated_data.get("email")
        # Force role to user
        validated_data['role'] = 'user' # Ensure that the role is set to 'user' for all new registrations, preventing users from assigning themselves admin roles

        existing_user = User.objects.filter(email=email).first()

        if existing_user and not existing_user.is_verified:
            # reuse same user instead of creating new one
            user = existing_user
            user.username = validated_data.get("username")
            user.first_name = validated_data.get("first_name")
            user.last_name = validated_data.get("last_name")
            user.phone = validated_data.get("phone")

        else:
            user = User(**validated_data)
            user.is_active = False
            user.is_verified = False

        user.set_password(password)
        user.save()

        return user
          
class UserSerializer(serializers.ModelSerializer):
    account_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name','phone', 'account_type')

    def get_account_type(self, obj):
        return obj.display_role

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)

    def validate(self, data):
        user = self.context['request'].user  # Get the user from the request context, which is set in the view when initializing the serializer. This allows us to access the currently authenticated user and check their old password against the provided value.

        # Check old password
        if not user.check_password(data['old_password']):
            raise serializers.ValidationError({"old_password": "Old password is not correct."})
        
        # Check new passwords match
        if data['new_password'] != data['new_password2']:
            raise serializers.ValidationError({"new_password": "Passwords do not match."})
        
        if user.check_password(data['new_password']):
            raise serializers.ValidationError({"new_password": "New password cannot be the same as the old password."})
       
        
        return data

class UpdateSerializer(serializers.ModelSerializer):
    
    def validate(self, data):
        
        if not data:
            raise serializers.ValidationError({"detail": "No input data provided."})
        
        user = self.instance # current user
        no_change = True

        for field, value in data.items():
            if hasattr(user, field) and getattr(user, field) != value: #hasattr checks if the user object has the field being updated, and getattr retrieves the current value of that field. If the current value is different from the new value provided in the update request, it means there is a change, and we set no_change to False. This allows us to detect if any actual changes are being made to the user's data, and if not, we can raise a validation error indicating that no changes were detected. This helps prevent unnecessary updates when the provided data is the same as the existing data.
                no_change = False
                break

        if no_change:
            raise serializers.ValidationError({"detail": "No changes detected."})
        
        username = data.get('username')
        email = data.get('email')
        phone = data.get('phone')

        if username and User.objects.exclude(id=user.id).filter(username=username).exists():
            raise serializers.ValidationError({"username": "Username already exists."})

        if email and User.objects.exclude(id=user.id).filter(email=email).exists():
            raise serializers.ValidationError({"email": "Email already exists."})
        
        if phone and User.objects.exclude(id=user.id).filter(phone=phone).exists():
            raise serializers.ValidationError({"phone": "Phone number already exists."})

        return data
    
    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name','phone')

class AdminUserSerializer(UpdateSerializer):
    class Meta(UpdateSerializer.Meta):
        fields = UpdateSerializer.Meta.fields + ('role',) 
 
class AdminSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ('role',) 

class ForgotPasswordSerializer(serializers.Serializer):
    identifier =  serializers.CharField()


class VerifyOTPSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    otp = serializers.CharField(max_length=6)


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()


class ResetPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password2 = serializers.CharField()

    def validate(self, data):

        if data['new_password'] != data['new_password2']:
            raise serializers.ValidationError("Passwords do not match")
        return data
    
class ResendOTPSerializer(serializers.Serializer):
    identifier = serializers.CharField()
   
