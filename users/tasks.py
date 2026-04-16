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
    send_email_task(email, subject, message)


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

    send_email_task(email, subject, message)