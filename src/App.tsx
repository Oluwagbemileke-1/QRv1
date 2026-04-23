import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import AttendancePage from "./pages/AttendancePage";
import CheckInPage from "./pages/CheckInPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEvents from "./pages/AdminEvents";
import AdminEventDetail from "./pages/AdminEventDetail.tsx";
import AdminEventSection from "./pages/AdminEventSection";
import AdminUsers from "./pages/AdminUsers";
import ProtectedRoute from "./components/ProtectedRoute";

function ScanAwareRedirect({ fallbackTo }: { fallbackTo: string }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const payload = params.get("payload") || "";
  const eventCode = params.get("event_code") || params.get("code") || "";

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

        {/* ── Public ── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email/*" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ── User routes ── */}
        <Route path="/dashboard" element={<ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute requiredRole="user"><AttendancePage /></ProtectedRoute>} />
        <Route path="/check-in" element={<CheckInPage />} />
        <Route path="/checkin" element={<ScanAwareRedirect fallbackTo="/check-in" />} />
        <Route path="/check_in" element={<ScanAwareRedirect fallbackTo="/check-in" />} />
        <Route path="/event-check-in" element={<ScanAwareRedirect fallbackTo="/check-in" />} />
        <Route path="/profile" element={<ProtectedRoute requiredRole="user"><ProfilePage /></ProtectedRoute>} />

        {/* ── Admin routes ── */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/events" element={<ProtectedRoute requiredRole="admin"><AdminEvents /></ProtectedRoute>} />
        <Route path="/admin/events/:eventId" element={<ProtectedRoute requiredRole="admin"><AdminEventDetail /></ProtectedRoute>} />
        <Route path="/admin/attendance" element={<ProtectedRoute requiredRole="admin"><AdminEventSection section="attendance" /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminEventSection section="analytics" /></ProtectedRoute>} />
        <Route path="/admin/fraud" element={<ProtectedRoute requiredRole="admin"><AdminEventSection section="fraud" /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />

        <Route path="*" element={<ScanAwareRedirect fallbackTo="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
