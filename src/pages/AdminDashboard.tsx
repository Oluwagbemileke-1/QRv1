import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import "./Dashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div className="dash-logo">QR</div>
        <div className="dash-user">
          <span className="dash-greeting">Admin</span>
          <button className="dash-logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-hero">
          <div className="dash-verified-badge">Admin workspace</div>
          <h1 className="dash-welcome">Admin Dashboard</h1>
          <p className="dash-caption">
            This placeholder page keeps the admin route valid while you build the full dashboard.
          </p>
        </div>

        <div className="dash-cards">
          <div className="dash-card">
            <div className="dash-card-icon">A</div>
            <h3>Overview</h3>
            <p>Use this space for high-level admin metrics and controls.</p>
          </div>

          <Link to="/dashboard" className="dash-card dash-card--link">
            <div className="dash-card-icon">U</div>
            <h3>User Dashboard</h3>
            <p>Jump back to the main user dashboard.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
