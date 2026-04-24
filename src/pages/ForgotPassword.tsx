import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, verifyOtp, resendOtp, resetPassword } from "../api/auth";
import "./Auth.css";

type Step = "identifier" | "otp" | "reset" | "done";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await forgotPassword(identifier);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await verifyOtp(identifier, otp);
      setStep("reset");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setResendMsg("");
    setError("");

    try {
      await resendOtp(identifier);
      setResendMsg("A new OTP has been sent to your email.");

      let secs = 60;
      setResendCooldown(secs);

      const timer = setInterval(() => {
        secs -= 1;
        setResendCooldown(secs);
        if (secs <= 0) clearInterval(timer);
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP.");
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword !== newPassword2) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(identifier, newPassword, newPassword2);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Send OTP", "Verify OTP", "New Password"];
  const stepIndex = step === "identifier" ? 0 : step === "otp" ? 1 : step === "reset" ? 2 : 3;

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">QR</span>
          <h1 className="auth-title">Reset password</h1>
          <p className="auth-subtitle">
            {step === "identifier" && "Enter your username, email or phone to receive an OTP"}
            {step === "otp" && "We sent a 6-digit OTP to your registered email"}
            {step === "reset" && "Choose a new password for your account"}
            {step === "done" && "Your password has been reset successfully"}
          </p>
        </div>

        {step !== "done" && (
          <div className="fp-steps">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`fp-step ${i < stepIndex ? "fp-step--done" : i === stepIndex ? "fp-step--active" : ""}`}
              >
                <div className="fp-step-dot">
                  {i < stepIndex ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5l2 2 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className="fp-step-label">{s}</span>
              </div>
            ))}
          </div>
        )}

        {step === "identifier" && (
          <form onSubmit={handleSendOtp} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="field-group">
              <label htmlFor="identifier">Username / Email / Phone</label>
              <input
                id="identifier"
                type="text"
                placeholder="Enter your username, email or phone"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            {resendMsg && <div className="fp-resend-msg">{resendMsg}</div>}

            <div className="field-group">
              <label htmlFor="otp">6-digit OTP</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter the OTP from your email"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                required
                className="otp-input"
              />
              <span className="field-hint">OTP expires in 10 minutes</span>
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : "Verify OTP"}
            </button>

            <button
              type="button"
              className="fp-resend-btn"
              onClick={handleResend}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Didn't get it? Resend OTP"}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleReset} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="field-group">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                placeholder="Min. 8 characters"
                minLength={8}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="new-password2">Confirm new password</label>
              <input
                id="new-password2"
                type="password"
                placeholder="Repeat new password"
                value={newPassword2}
                onChange={(e) => {
                  setNewPassword2(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : "Reset password"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="verify-state">
            <div className="verify-icon verify-icon--success">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 14.5l4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="verify-title">Password reset!</h2>
            <p className="verify-sub">Your password has been updated. You can now sign in with your new password.</p>
            <button
              className="auth-btn"
              style={{ marginTop: "1.5rem" }}
              onClick={() => navigate("/login")}
            >
              Go to login
            </button>
          </div>
        )}

        {step !== "done" && (
          <p className="auth-switch" style={{ marginTop: "1.25rem" }}>
            <Link to="/login">&larr; Back to login</Link>
          </p>
        )}
      </div>
    </div>
  );
}
