import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../api/auth";

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const rawUser = localStorage.getItem("user");
    const user = rawUser ? (JSON.parse(rawUser) as { role?: string }) : null;

    if (requiredRole === "admin" && user?.role !== "admin") {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
