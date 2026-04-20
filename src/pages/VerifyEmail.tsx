import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail, resendVerificationEmail } from "../api/auth";
import "./Auth.css";

type State = "pending" | "loading" | "success" | "already" | "expired" | "used" | "invalid";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const [state, setState] = useState<State>(token ? "loading" : "pending");
  const [email, setEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (!token) {
      setState("pending");
      return;
    }

    verifyEmail(token)
      .then((data: { message?: string }) => {
        const msg = data.message?.toLowerCase() || "";
        if (msg.includes("already")) {
          setState("already");
        } else {
          setState("success");
        }
      })
      .catch((err: Error) => {
        const msg = err.message.toLowerCase();
        if (msg.includes("expired")) {
          setState("expired");
        } else if (msg.includes("already used")) {
          setState("used");
        } else {
          setState("invalid");
        }
      });
  }, [token]);

  useEffect(() => {
    if (state !== "success" && state !== "already") {
      return;
    }

    const timer = window.setTimeout(() => {
      navigate("/login");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [navigate, state]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    setResendError("");
    setResendMsg("");

    try {
      const data = await resendVerificationEmail(email);
      setResendMsg(data.message || "Verification email sent!");
    } catch (err: unknown) {
      setResendError(err instanceof Error ? err.message : "Failed to resend.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">QR</span>
        </div>

        {state === "pending" && (
          <div className="verify-state">
            <div className="verify-icon verify-icon--info">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 10.5h12M8 14h12M8 17.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="verify-title">Check your email</h2>
            <p className="verify-sub">
              We sent a verification link{email ? ` to ${email}` : ""}. Your account should only be usable after
              you open that link and verify your email.
            </p>

            {resendMsg ? (
              <div className="auth-success" style={{ marginTop: "1.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M5 9.5l2.5 2.5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <p className="auth-success-title">Email sent!</p>
                  <p className="auth-success-sub">{resendMsg} Check your inbox.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResend} className="auth-form" style={{ marginTop: "1.5rem" }}>
                {resendError && <div className="auth-error">{resendError}</div>}
                <div className="field-group">
                  <label htmlFor="verify-email">Your email address</label>
                  <input
                    id="verify-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="auth-btn" disabled={resendLoading}>
                  {resendLoading ? <span className="spinner" /> : "Resend verification email"}
                </button>
              </form>
            )}
          </div>
        )}

        {state === "loading" && (
          <div className="verify-state">
            <div className="verify-spinner" />
            <p className="verify-label">Verifying your email...</p>
          </div>
        )}

        {state === "success" && (
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
            <h2 className="verify-title">Email verified!</h2>
            <p className="verify-sub">Your account is now active. You can sign in. Redirecting you to login...</p>
            <Link
              to="/login"
              className="auth-btn"
              style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: "1.5rem" }}
            >
              Go to login
            </Link>
          </div>
        )}

        {state === "already" && (
          <div className="verify-state">
            <div className="verify-icon verify-icon--info">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 9v5M14 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="verify-title">Already verified</h2>
            <p className="verify-sub">This email is already verified. Redirecting you to login...</p>
            <Link
              to="/login"
              className="auth-btn"
              style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: "1.5rem" }}
            >
              Sign in
            </Link>
          </div>
        )}

        {(state === "expired" || state === "used" || state === "invalid") && (
          <div className="verify-state">
            <div className="verify-icon verify-icon--error">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 9l10 10M19 9L9 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="verify-title">
              {state === "expired" ? "Link expired" : state === "used" ? "Link already used" : "Invalid link"}
            </h2>
            <p className="verify-sub">
              {state === "expired"
                ? "This verification link has expired. Request a new one below."
                : state === "used"
                  ? "This link has already been used. If you're not verified yet, request a new link."
                  : "This verification link is invalid. Request a new one below."}
            </p>

            {resendMsg ? (
              <div className="auth-success" style={{ marginTop: "1.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M5 9.5l2.5 2.5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <p className="auth-success-title">Email sent!</p>
                  <p className="auth-success-sub">{resendMsg} Check your inbox.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResend} className="auth-form" style={{ marginTop: "1.5rem" }}>
                {resendError && <div className="auth-error">{resendError}</div>}
                <div className="field-group">
                  <label htmlFor="resend-email">Your email address</label>
                  <input
                    id="resend-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="auth-btn" disabled={resendLoading}>
                  {resendLoading ? <span className="spinner" /> : "Resend verification email"}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="auth-switch" style={{ marginTop: "1.5rem" }}>
          <Link to="/login">&larr; Back to login</Link>
        </p>
      </div>
    </div>
  );
}
