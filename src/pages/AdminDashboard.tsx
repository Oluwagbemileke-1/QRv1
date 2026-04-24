import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout, getStoredUser, getUserDisplayName } from "../api/auth";
import { getAllEventsList } from "../api/events";
import "./AdminLayout.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, active: 0, past: 0 });
  const [loading, setLoading] = useState(true);
  const displayName = getUserDisplayName(user);

  useEffect(() => {
    getAllEventsList()
      .then((events) => {
        setStats({
          total: events.length,
          upcoming: events.filter((e) => e.status === "Upcoming").length,
          active: events.filter((e) => e.status === "Active").length,
          past: events.filter((e) => e.status === "Past").length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowWelcomeToast(false);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navCards = [
    {
      to: "/admin/events",
      label: "Events",
      desc: "Create, manage and view all your events.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      to: "/admin/users",
      label: "Users",
      desc: "View and manage all registered users.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 21c0-3.866 2.686-7 6-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M16 14v7M13 17.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      to: "/admin/attendance",
      label: "Attendance",
      desc: "Open event attendance views and assigned-user records.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 10h16" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M8 14l2 2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      to: "/admin/analytics",
      label: "Analytics",
      desc: "Attendance stats and scan data per event.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 18l5-5 3 3 4-6 5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      to: "/admin/fraud",
      label: "Fraud Checks",
      desc: "Review flagged scans and fraud logs per event.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l7 4v6c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="adm-wrapper">
      <header className="adm-header">
        <div className="adm-header-left">
          <div className="adm-logo">QRAMS</div>
          <span className="adm-badge">Admin</span>
        </div>
        <div className="adm-header-right">
          {user && <span className="adm-greeting">{displayName}</span>}
          <button className="adm-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-hero">
          {showWelcomeToast && (
            <div className="adm-welcome-toast">Welcome, {displayName}</div>
          )}
          <h1 className="adm-title">Admin Dashboard</h1>
          <p className="adm-sub">Manage events, users, attendance and fraud checks as {displayName}.</p>
        </div>

        {/* Stat strip */}
        <div className="adm-stats">
          {[
            { label: "Total Events", val: loading ? "—" : stats.total },
            { label: "Upcoming", val: loading ? "—" : stats.upcoming, cls: "adm-stat--blue" },
            { label: "Active Now", val: loading ? "—" : stats.active, cls: "adm-stat--green" },
            { label: "Past", val: loading ? "—" : stats.past },
          ].map((s) => (
            <div key={s.label} className={`adm-stat ${s.cls || ""}`}>
              <span className="adm-stat-num">{s.val}</span>
              <span className="adm-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Nav cards */}
        <div className="adm-cards">
          {navCards.map((c) => (
            <Link key={c.label} to={c.to} className="adm-card">
              <div className="adm-card-icon">{c.icon}</div>
              <h3 className="adm-card-title">{c.label}</h3>
              <p className="adm-card-desc">{c.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
