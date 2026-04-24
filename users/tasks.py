from notifications.tasks import send_email_task



def verify_email_task(first_name,verification_link,email):
    subject="Verify your email"
    message=f"""
Hello {first_name},

Click the link below to verify your email:

{verification_link}

This link expires in 10 minutes

Thanks,
QRAMS.
    """
    return send_email_task(email, subject, message)



def resend_verify_email_task(first_name,verification_link,email):
    subject="Resend Verification Link"
    message=f"""
Hello {first_name},

Click the link below to verify your email:

{verification_link}

This link expires in 10 minutes

Thanks,
QRAMS.
    """
    send_email_task(email, subject, message)


def verify_changed_email_task(first_name, verification_link, email):
    subject="Verify your new email address"
    message=f"""
Hello {first_name},

Click the link below to verify your new email address:

{verification_link}

This link expires in 10 minutes

Thanks,
QRAMS.
    """
    return send_email_task(email, subject, message)


def send_welcome_email(email, first_name):
    subject="Welcome to  QR Attendance Management System"
    message=f"""
Hi {first_name},

Your account has been created successfully.

You  can now login and start using the system.

Get ready  for a seamless experience.

Thanks,
QRAMS.
    """
    return send_email_task(email, subject, message)


def send_otp(first_name,otp,email):
    subject="Password Reset OTP"
    message=f"""
Hi {first_name},

Your OTP is {otp} 

It will expire in 10 minutes.

Thanks,
QRAMS.
    """ 

    send_email_task(email, subject, message)

    


def resend_otp_email(first_name,otp,email):
       
    subject="Password Reset Resend OTP"
    message=f"""
Hi {first_name},

Your new OTP is {otp} 

It will expire in 10 minutes.

Thanks,
QRAMS.
    """
    
    send_email_task(email, subject, message)
    

   
def password_changed(first_name,email):
        
    subject="Password Changed Successfully"
    message=f"""
Hi {first_name},

Your password has been changed successfully.

You can now login.

Thanks,
QRAMS.
    """

    return send_email_task(email, subject, message)


def email_changed_notice_task(first_name, old_email, new_email):
    subject="Email Changed Successfully"
    message=f"""
Hello {first_name},

Your account email has been changed successfully.

Old email: {old_email}
New email: {new_email}

If you did not make this change, please contact support immediately.

Thanks,
QRAMS.
    """

    return send_email_task(old_email, subject, message)


def email_changed_success_task(first_name, email):
    subject="Email Verified Successfully"
    message=f"""
Hello {first_name},

Your email has been changed and verified successfully.

You can continue using your account normally.

Thanks,
QRAMS.
    """

    return send_email_task(email, subject, message)
