from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .serializers import RegisterSerializer, UserSerializer, ChangePasswordSerializer, AdminUserSerializer, UpdateSerializer,AdminSerializer, ForgotPasswordSerializer,VerifyOTPSerializer,ResetPasswordSerializer,ResendOTPSerializer
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from .models import PasswordResetOTP,EmailVerification
import random
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from datetime import timedelta
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .tasks import send_welcome_email,send_otp,password_changed,resend_otp_email,verify_email_task,resend_verify_email_task
from django.conf import settings
from django.core.mail import send_mail
from django.http import HttpResponse


User = get_user_model() # Get the custom user model defined in users/models.py


def is_superuser_request(request):
    return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

def is_verified_active_user(user):
    return bool(user and user.is_active and user.is_verified)

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Register",
    operation_description="**Register user **",
    request_body=RegisterSerializer
)

@api_view(['POST'])

def register(request):
    serializer = RegisterSerializer(data=request.data)
    # import pdb; pdb.set_trace()
    if serializer.is_valid():
       user = serializer.save(is_active=False,is_verified=False)
       user.save()

       # Invalidate any older verification links for this user before issuing a new one.
       EmailVerification.objects.filter(user=user).delete()

       raw_token = EmailVerification.generate_token()
       hashed = EmailVerification.hash_token(raw_token)


       EmailVerification.objects.create(user=user,token_hash=hashed)
       domain = request.get_host()
       verification_link = f"{settings.FRONTEND_URL.rstrip('/' )}/verify-email/{raw_token}"
       try:
           email_sent = verify_email_task(user.first_name, verification_link, user.email)
       except Exception as e:
           print("EMAIL SEND EXCEPTION:", str(e))
           email_sent = False

       if email_sent:
           return Response({
               "message": "User created successfully. Verification email sent.",
               "email": user.email,
               "next_step": "Check inbox or use resend verification if needed"
           }, status=status.HTTP_201_CREATED)
       else:
           return Response({
               "message": "User created, but verification email failed.",
               "email": user.email,
               "next_step": "Contact support or resend verification"
           }, status=status.HTTP_202_ACCEPTED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
    method='get',
    manual_parameters=[
        openapi.Parameter(
            'token',
            openapi.IN_PATH,
            description="Email verification token",
            type=openapi.TYPE_STRING
        )
    ],
    tags=["👤 USERS"],
    operation_summary="Verify Email",
    operation_description="Verify the user's email when the link is opened."
)
@api_view(["GET"])
def verify_email(request, token):
    token_hash = EmailVerification.hash_token(token)
    try:
        verification = EmailVerification.objects.get(token_hash=token_hash)
    except EmailVerification.DoesNotExist:
        return HttpResponse(
            "<h2>Invalid verification link</h2><p>This verification link is invalid or no longer available.</p>",
            status=400
        )

    user = verification.user

    if verification.is_expired():
        verification.delete()
        return HttpResponse(
            "<h2>Verification link expired</h2><p>Please request a new verification email.</p>",
            status=400
        )
    
    if user.is_verified and user.is_active:
        return HttpResponse(
            "<h2>Email already verified</h2><p>Your account is already verified. You can log in now.</p>",
            status=200
        )
    
    if verification.is_verified or verification.used:
        return HttpResponse(
            "<h2>Email already verified</h2><p>Your account is already verified. You can log in now.</p>",
            status=200
        )
    
    verification.used = True
    verification.is_verified = True
    verification.save(update_fields=["used", "is_verified"])

    user.is_active = True
    user.is_verified = True
    user.save(update_fields=["is_active", "is_verified"])
    send_welcome_email(user.email, user.first_name)
    return HttpResponse(
        "<h2>Email verified successfully</h2><p>Your account has been verified. You can log in now.</p>",
        status=200
    )

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Resend Verification link",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'email': openapi.Schema(type=openapi.TYPE_STRING)
        },
        required=['email']
    )
)
@api_view(["POST"])
def resend_verification(request):
    email = request.data.get("email")
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if user.is_active:
        return Response({"message": "Already verified"})
    
    last_verification = EmailVerification.objects.filter(user=user).order_by("-created_at").first()

    if last_verification:
        time_diff = (timezone.now() - last_verification.created_at).total_seconds()

        if time_diff < 60:
            return Response({
                "status": "error",
                "message": f"Wait {int(60 - time_diff)}s before requesting another link"
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        last_verification.is_verified = False
        last_verification.save()

    # Ensure only the newest verification link remains usable.
    EmailVerification.objects.filter(user=user).delete()

    raw_token = EmailVerification.generate_token()
    hashed = EmailVerification.hash_token(raw_token)
    EmailVerification.objects.create(user=user, token_hash=hashed)
    domain = request.get_host()
    verification_link = f"{settings.FRONTEND_URL.rstrip('/' )}/verify-email/{raw_token}"
    resend_verify_email_task(user.first_name, verification_link, user.email)

    return Response({"message": "Verification email resent","email": user.email}, status=status.HTTP_200_OK)

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Login",
    operation_description="**Login user**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'username': openapi.Schema(type=openapi.TYPE_STRING),
            'password': openapi.Schema(type=openapi.TYPE_STRING),
        },
        required=['username', 'password']
    )
)


@api_view(['POST'])
def login(request):
    username = request.data.get('username') 
    password = request.data.get('password')
    if not username or not password:
        return Response({"error": "Please provide both username and password"}, status=status.HTTP_400_BAD_REQUEST)
    
    user = User.objects.filter(Q(username=username) | Q(email=username) | Q(phone=username)).first() # allow users to login with either their username, email, or phone number by using a Q object to perform an OR query across these fields also used filter().first() to return the first matching user or None if no user is found, which allows us to handle the case where the identifier does not match any user without raising an exception. This provides a more graceful way to handle login attempts with invalid identifiers.
    if not user or not user.check_password(password): # check if a user was found and if the provided password matches the user's password
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)  
    
    if not user.is_active:
        return Response({"error":"Email not verified"}, status=status.HTTP_403_FORBIDDEN)
    
    if not user.is_verified:
        return Response({"error":"Email not verified"}, status=status.HTTP_403_FORBIDDEN)
    refresh = RefreshToken.for_user(user)
    
    return Response({
        "message": "Login successful",
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }, status=status.HTTP_200_OK)

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Logout",
    operation_description="**Logout user and blacklist refresh token**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['refresh'],
        properties={
            'refresh': openapi.Schema(
                type=openapi.TYPE_STRING,
                description="Refresh token"
            ),
        },
    )
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    refresh_token = request.data.get("refresh") 

    if not refresh_token:
        return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        token = RefreshToken(refresh_token)
        token.blacklist() # blacklists the refresh token, preventing it from being used again
        return Response({"message": "Logout successful"}, status=status.HTTP_205_RESET_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
    method='get',
    tags=["👤 USERS"],
    operation_summary="List Users",
    operation_description="**Superuser: View all users (search + filter + pagination)**",
    manual_parameters=[
        openapi.Parameter('search', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('role', openapi.IN_QUERY, type=openapi.TYPE_STRING),
    ]
)
# User management views
# fetch all users, search by username/email/first_name/last_name, filter by role, pagination
@api_view(['GET'])
@permission_classes([IsAuthenticated]) 
def users_list(request):
    if not is_superuser_request(request):
        return Response({"error": "Permission denied"}, status=403)
    

    users = User.objects.all().order_by('id')
    search_query = request.GET.get('search', None)
    if search_query:
        users = users.filter(
            Q(username__icontains=search_query) | 
            Q(email__icontains=search_query) |
            Q(first_name__icontains=search_query) | 
            Q(last_name__icontains=search_query)
        )
    role = request.GET.get('role')
    if role:
        users = users.filter(role__iexact=role)
    # pagination
    paginator = PageNumberPagination()
    result_page = paginator.paginate_queryset(users, request)
    serializer = AdminSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)

@swagger_auto_schema(
    method='get',
    tags=["👤 USERS"],
    operation_summary="User Detail",
    operation_description="**Get a specific user profile**",
    manual_parameters=[
        openapi.Parameter('id', openapi.IN_PATH, type=openapi.TYPE_INTEGER)
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_detail(request, id):
    try:
     user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    
    # Users can view themselves; only superusers can view any user.
    if request.user.id != user.id and not is_superuser_request(request):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    
    if is_superuser_request(request):
        serializer = AdminSerializer(user)
    else:
        serializer = UserSerializer(user)
    return Response(serializer.data, status=status.HTTP_200_OK)

@swagger_auto_schema(
    method='put',
    tags=["👤 USERS"],
    operation_summary="Update User",
    operation_description="**Update user profile**",
    request_body=UpdateSerializer
) 
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user(request, id):
    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    # Users can update themselves; only superusers can update any user.
    if request.user.id != user.id and not is_superuser_request(request):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    
    data = request.data.copy() # Create a mutable copy of the request data to modify it before passing it to the serializer. This allows us to enforce certain rules (like preventing regular users from changing their role) without affecting the original request data.

    # Only superusers can change privileged fields.
    if not is_superuser_request(request):
        data.pop('role', None)
        data.pop('is_staff', None)
        data.pop('is_superuser', None)
        data.pop('is_active', None)
    
    if is_superuser_request(request):
        serializer = AdminUserSerializer(user, data=data, partial=True) 
    else:
        serializer = UpdateSerializer(user, data=data, partial=True) 
    

    if serializer.is_valid():
        serializer.save()
        return Response({"message": "User updated successfully", "data": serializer.data}, status=status.HTTP_200_OK)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
    method='delete',
    tags=["👤 USERS"],
    operation_summary="Delete User",
    operation_description="**Superuser deletes a user**",
    manual_parameters=[
        openapi.Parameter('id', openapi.IN_PATH, type=openapi.TYPE_INTEGER)
    ]
)  
@api_view(['DELETE'])
@permission_classes([IsAuthenticated]) 
def delete_user(request, id):

    if not is_superuser_request(request):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        user=User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.user.id == user.id:
        return Response({"error": "You cannot delete your own account from this endpoint"}, status=status.HTTP_400_BAD_REQUEST)
    
    user.delete()
    return Response({"message": "User deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

@swagger_auto_schema(
    method='put',
    tags=["👤 USERS"],
    operation_summary="Change Password",
    operation_description="**Change current user password**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['old_password', 'new_password','new_password2'],
        properties={
            'old_password': openapi.Schema(type=openapi.TYPE_STRING),
            'new_password': openapi.Schema(type=openapi.TYPE_STRING),
            'new_password2': openapi.Schema(type=openapi.TYPE_STRING),
        },
    ),
    responses={200: "Password changed successfully"}
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request}) # Pass the request context to the serializer so that we can access the currently authenticated user in the serializer's validate method. This allows us to check the old password against the user's actual password and ensure that only the authenticated user can change their own password.
    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        password_changed(user.first_name,user.email)

        return Response({"message": "Password changed successfully"}, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Forgot Password",
    operation_description="**Send OTP to email**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['identifier'],
        properties={
            'identifier': openapi.Schema(
                type=openapi.TYPE_STRING,
                description="username / email / phone"
            ),
        },
    ),
    responses={200: "OTP sent"}
)

@api_view(['POST'])
def forgot_password(request):
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    identifier = serializer.validated_data['identifier']

    user = User.objects.filter(
        Q(username=identifier) |
        Q(email=identifier) |
        Q(phone=identifier) 
    ).first()

    
    if not user:
        return Response({"status": "error", "message":"User not found"}, status=status.HTTP_404_NOT_FOUND)

    if not is_verified_active_user(user):
        return Response({"status": "error", "message": "Email not verified"}, status=status.HTTP_403_FORBIDDEN)

    PasswordResetOTP.objects.filter(user=user).update(used=True)

    otp = str(random.randint(100000, 999999))
    otp_obj=PasswordResetOTP(user=user)
    otp_obj.set_otp(otp)
    otp_obj.save()
    send_otp(user.first_name,otp,user.email)
    
    

    return Response({"status":"success", "message":"OTP sent"})

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Verify OTP",
    operation_description="**Verify OTP code**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['identifier', 'otp'],
        properties={
            'identifier': openapi.Schema(type=openapi.TYPE_STRING),
            'otp': openapi.Schema(type=openapi.TYPE_STRING),
        },
    ),
    responses={200: "OTP verified"}
)
@api_view(['POST'])
def verify_otp(request):
    serializer = VerifyOTPSerializer(data=request.data)
    serializer.is_valid(raise_exception =True)
    
    identifier = serializer.validated_data['identifier']
    otp = serializer.validated_data['otp']

    user = User.objects.filter(
            Q(username = identifier) |
            Q(email=identifier) |
            Q(phone=identifier)
    ).first()

    if not user:
            return Response({"status": "error", "message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if not is_verified_active_user(user):
        return Response({"status": "error", "message": "Email not verified"}, status=status.HTTP_403_FORBIDDEN)
 
    otp_obj = PasswordResetOTP.objects.filter(user=user, used=False).order_by('-created_at').first()
    if not otp_obj:
        return Response({"status":"error", "message":"OTP not found"}, status=status.HTTP_404_NOT_FOUND)
    

    if otp_obj.is_expired():
        return Response({"status": "error", "message": "OTP expired"}, status=status.HTTP_400_BAD_REQUEST)
    
    if not otp_obj.check_otp(otp):
        return Response({"status": "error", "message": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
    
    otp_obj.used = True
    otp_obj.is_verified = True
    otp_obj.save(update_fields=['used','is_verified'])

    return Response({
        "status": "success",
        "message": "OTP verified",
    })

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Reset Password",
    operation_description="**Reset password after OTP verification**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['identifier', 'new_password','new_password2'],
        properties={
            'identifier': openapi.Schema(type=openapi.TYPE_STRING),
            'new_password': openapi.Schema(type=openapi.TYPE_STRING),
            'new_password2': openapi.Schema(type=openapi.TYPE_STRING),
        },
    ),
    responses={200: "Password reset successful"}
)
@api_view(['POST'])
def reset_password(request):

    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    identifier = serializer.validated_data['identifier']
    new_password = serializer.validated_data['new_password']
    user = User.objects.filter(
        Q(username = identifier) |
        Q(email=identifier) |
        Q(phone=identifier)
    ).first()

    if not user:
        return Response({"status":"error", "message":"User not found"}, status=status.HTTP_404_NOT_FOUND)
    if not is_verified_active_user(user):
        return Response({"status": "error", "message": "Email not verified"}, status=status.HTTP_403_FORBIDDEN)
    otp_obj = PasswordResetOTP.objects.filter(user=user, is_verified=True, used=True).order_by('-created_at').first()
    if not otp_obj:
        return Response({"status": "error", "message": "OTP not verified"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new_password, user)
    except ValidationError as e:
        return Response({"error": e.messages}, status=status.HTTP_400_BAD_REQUEST)
    if user.check_password(new_password):
        return Response({
            "error":"New password can not be the same as old password"
        }, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new_password)
    user.save()
    PasswordResetOTP.objects.filter(user=user).delete()
    return Response({"status": "success", "message": "Password reset successful"})

@swagger_auto_schema(
    method='post',
    tags=["👤 USERS"],
    operation_summary="Resend OTP",
    operation_description="**Resend OTP to user**",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['identifier'],
        properties={
            'identifier': openapi.Schema(type=openapi.TYPE_STRING),
        },
    ),
    responses={200: "OTP resent successfully"}
)
@api_view(['POST'])
def resend_otp(request):
    serializer = ResendOTPSerializer(data = request.data)
    serializer.is_valid(raise_exception=True)

    identifier = serializer.validated_data['identifier']
    user = User.objects.filter(
        Q(username=identifier) |
        Q(email=identifier) |
        Q(phone=identifier)
    ).first()

    if not user:
        return Response({"status":"error", "message":"User not found"}, status=status.HTTP_404_NOT_FOUND)

    if not is_verified_active_user(user):
        return Response({"status": "error", "message": "Email not verified"}, status=status.HTTP_403_FORBIDDEN)
    
    last_otp = PasswordResetOTP.objects.filter(user=user,used=False).order_by('-created_at').first()

    if last_otp:
        time_diff = (timezone.now() - last_otp.created_at).total_seconds()

        if time_diff < 60:
            return Response(
                {
                    "status":"error",
                    "message": f"Wait {int(60 - time_diff)}s before requesting another OTP"
                }, status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        last_otp.used = True
        last_otp.save()
    PasswordResetOTP.objects.filter(user=user).update(used=True)
    otp = str(random.randint(100000, 999999))
    otp_obj = PasswordResetOTP(user=user)
    otp_obj.set_otp(otp)
    otp_obj.save()

    resend_otp_email(user.first_name,otp,user.email)

    # print("RESEND OTP:", otp)

    return Response({
        "status": "success",
        "message": "OTP resent successfully"
    })


