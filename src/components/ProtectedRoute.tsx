import { Navigate } from "react-router-dom";
import { getStoredUser, isAuthenticated } from "../api/auth";

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
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
