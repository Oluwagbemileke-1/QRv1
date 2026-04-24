import { useState } from "react";
// import type { FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";
import "./Auth.css";

const INITIAL = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  confirm_password: "",
};

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = (() => {
    const params = new URLSearchParams(location.search);
    const explicitNext = params.get("next") || "";
    if (explicitNext) {
      return explicitNext;
    }

    const payload = params.get("payload") || "";
    const eventCode = params.get("event_code") || params.get("code") || "";

    if (payload) {
      const checkInParams = new URLSearchParams({ payload });
      if (eventCode) {
        checkInParams.set("event_code", eventCode);
      }
      return `/check-in?${checkInParams.toString()}`;
    }

    return sessionStorage.getItem("pendingCheckInPath") || localStorage.getItem("pendingCheckInPath") || "";
  })();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(form);
      const params = new URLSearchParams({ email: form.email });
      if (nextPath) {
        params.set("next", nextPath);
      }
      navigate(`/verify-email?${params.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card auth-card--wide">
        <div className="auth-brand">
          <span className="auth-logo">QRAMS</span>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">
            {nextPath ? "Create your account to continue with this event" : "Fill in your details to get started"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="first_name">First name</label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                placeholder="John"
                value={form.first_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="last_name">Last name</label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                placeholder="Doe"
                value={form.last_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+234 800 000 0000"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
              />
            </div>
            <div className="field-group">
              <label htmlFor="confirm_password">Confirm password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={form.confirm_password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
