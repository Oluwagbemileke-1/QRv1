import { useNavigate, Link } from "react-router-dom";
import { logout } from "../api/auth";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const stored = localStorage.getItem("user");
  const user = stored ? JSON.parse(stored) : null;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div className="dash-logo">QR</div>
        <div className="dash-user">
          {user && (
            <span className="dash-greeting">
              {user.first_name || user.username}
            </span>
          )}
          <button className="dash-logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-hero">
          <div className="dash-verified-badge">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
              <path
                d="M6 10.5l2.5 2.5 5.5-5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Email verified
          </div>
          <h1 className="dash-welcome">
            Welcome{user?.first_name ? `, ${user.first_name}` : ""}!
          </h1>
          <p className="dash-caption">
            Your account is set up and ready. You're now logged in.
          </p>
        </div>

        <div className="dash-cards">
          <div className="dash-card">
            <div className="dash-card-icon">◻</div>
            <h3>Generate QR</h3>
            <p>Create a new QR code for your content.</p>
          </div>

          {/* Attendance card — links to the full attendance page */}
          <Link to="/attendance" className="dash-card dash-card--link">
            <div className="dash-card-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="3" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3 9h16" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 3v2.5M15 3v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M7 13.5l2 2 4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>My Attendance</h3>
            <p>View your full event attendance history and records.</p>
          </Link>

          <div className="dash-card">
            <div className="dash-card-icon">◷</div>
            <h3>Analytics</h3>
            <p>Track scans and engagement over time.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
