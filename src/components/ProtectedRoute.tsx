import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getStoredRefreshToken, getStoredUser, isAuthenticated, refreshAccessToken } from "../api/auth";

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const location = useLocation();
  const [authStatus, setAuthStatus] = useState<"checking" | "ready" | "unauthenticated">(
    isAuthenticated() ? "ready" : (getStoredRefreshToken() ? "checking" : "unauthenticated")
  );

  useEffect(() => {
    let cancelled = false;

    if (isAuthenticated()) {
      setAuthStatus("ready");
      return;
    }

    const refresh = getStoredRefreshToken();
    if (!refresh) {
      setAuthStatus("unauthenticated");
      return;
    }

    setAuthStatus("checking");

    refreshAccessToken()
      .then((token) => {
        if (!cancelled) {
          setAuthStatus(token ? "ready" : "unauthenticated");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthStatus("unauthenticated");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  if (authStatus === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0c0e",
          color: "#94a3b8",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "0.95rem",
        }}
      >
        Restoring your session...
      </div>
    );
  }

  if (authStatus !== "ready" || !isAuthenticated()) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (requiredRole) {
    const user = getStoredUser();
    const userRole =
      user?.role || (user?.is_superuser || user?.is_staff ? "admin" : "user");

    if (requiredRole === "admin" && userRole !== "admin") {
      return <Navigate to="/dashboard" replace />;
    }

    if (requiredRole === "user" && userRole === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
