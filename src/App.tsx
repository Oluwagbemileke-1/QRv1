import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import AttendancePage from "./pages/AttendancePage";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ── Public auth routes ── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/*
          Django sends: http://<domain>/api/users/verify-email/<token>
          That's a backend URL — the email link goes directly to Django.
          Django processes it and returns a JSON response.

          BUT if you want a frontend page to handle the token instead,
          set the verification link in Django to point to your frontend:
            verification_link = f"https://your-frontend.com/verify-email/{raw_token}"
          Then this route catches it and calls the Django API from the browser.
        */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        {/* Forgot password — 3 steps in one page */}
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ── User routes (protected) ── */}
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

        {/* ── Admin routes (protected) ── */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
