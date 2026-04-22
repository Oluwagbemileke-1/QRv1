import { useMemo, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, persistAuthSession, saveUserIdentityFallback } from "../api/auth";
import { getAllEvents } from "../api/events";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = useMemo(() => {
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

    return sessionStorage.getItem("pendingCheckInPath") || "";
  }, [location.search]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(form);
      const session = persistAuthSession(data);
      const resolvedUser = session.user || saveUserIdentityFallback(form.username);

      if (!session.token) {
        throw new Error("Login succeeded but no access token was returned.");
      }

      if (nextPath) {
        sessionStorage.removeItem("pendingCheckInPath");
        navigate(nextPath);
        return;
      }

      let isAdmin = resolvedUser?.role === "admin";

      if (!isAdmin) {
        try {
          await getAllEvents({ page: 1 });
          isAdmin = true;

          if (resolvedUser) {
            const adminUser = { ...resolvedUser, role: "admin" as const };
            localStorage.setItem("user", JSON.stringify(adminUser));
          }
        } catch {
          isAdmin = false;
        }
      }

      navigate(nextPath || (isAdmin ? "/admin/dashboard" : "/dashboard"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">QR</span>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">
            {nextPath ? "Sign in to continue your check-in" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="field-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <p className="auth-forgot">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
