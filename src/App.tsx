import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEventDetail from "./pages/AdminEventDetail.tsx";
import AdminEvents from "./pages/AdminEvents";
import AdminEventSection from "./pages/AdminEventSection";
import AdminUsers from "./pages/AdminUsers";
import AttendancePage from "./pages/AttendancePage";
import CheckInPage from "./pages/CheckInPage";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import ProfilePage from "./pages/ProfilePage";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";

function ScanAwareRedirect({ fallbackTo }: { fallbackTo: string }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const payload = params.get("payload") || "";
  const eventCode = params.get("event_code") || params.get("code") || "";
  const verifyToken = params.get("token") || "";
  const email = params.get("email") || "";
  const next = params.get("next") || "";

  if (verifyToken) {
    const verifyParams = new URLSearchParams({ token: verifyToken });
    if (email) {
      verifyParams.set("email", email);
    }
    if (next) {
      verifyParams.set("next", next);
    }
    return <Navigate to={`/verify-email?${verifyParams.toString()}`} replace />;
  }

  if (payload) {
    const nextParams = new URLSearchParams({ payload });
    if (eventCode) {
      nextParams.set("event_code", eventCode);
    }
    return <Navigate to={`/check-in?${nextParams.toString()}`} replace />;
  }

  return <Navigate to={fallbackTo} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScanAwareRedirect fallbackTo="/login" />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/verify-email/*" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="user">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute requiredRole="user">
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route path="/check-in" element={<CheckInPage />} />
        <Route path="/checkin" element={<ScanAwareRedirect fallbackTo="/check-in" />} />
        <Route path="/check_in" element={<ScanAwareRedirect fallbackTo="/check-in" />} />
        <Route path="/event-check-in" element={<ScanAwareRedirect fallbackTo="/check-in" />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRole="user">
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/:eventId"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminEventDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminEventSection section="attendance" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminEventSection section="analytics" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/fraud"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminEventSection section="fraud" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<ScanAwareRedirect fallbackTo="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
