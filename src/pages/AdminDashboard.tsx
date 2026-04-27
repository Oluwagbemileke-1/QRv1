import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser, getUserDisplayName, logout } from "../api/auth";
import { getAllEventsList } from "../api/events";
import "./AdminLayout.css";

type DashboardStats = {
  total: number;
  upcoming: number;
  active: number;
  past: number;
  deleted: number;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const isSuperuser = user?.is_superuser === true;
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    upcoming: 0,
    active: 0,
    past: 0,
    deleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const displayName = getUserDisplayName(user);

  useEffect(() => {
    getAllEventsList()
      .then((events) => {
        const deleted = events.filter((event) => String(event.status).toLowerCase() === "deleted").length;
        const visibleEvents = isSuperuser
          ? events
          : events.filter((event) => String(event.status).toLowerCase() !== "deleted");
        const shouldIncludeDeletedInTotal = isSuperuser || deleted > 0;

        setStats({
          total: shouldIncludeDeletedInTotal ? events.length : visibleEvents.length,
          upcoming: visibleEvents.filter((event) => String(event.status).toLowerCase() === "upcoming").length,
          active: visibleEvents.filter((event) => String(event.status).toLowerCase() === "active").length,
          past: visibleEvents.filter((event) => String(event.status).toLowerCase() === "past").length,
          deleted,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSuperuser]);

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

  const statCards = [
    { label: "Total Events", val: loading ? "-" : stats.total },
    { label: "Upcoming", val: loading ? "-" : stats.upcoming, cls: "adm-stat--blue" },
    { label: "Active Now", val: loading ? "-" : stats.active, cls: "adm-stat--green" },
    { label: "Past", val: loading ? "-" : stats.past },
    ...((isSuperuser || stats.deleted > 0)
      ? [{ label: "Deleted", val: loading ? "-" : stats.deleted, cls: "adm-stat--red" }]
      : []),
  ];

  return (
    <div className="adm-wrapper">
      <header className="adm-header">
        <div className="adm-header-left">
          <div className="adm-logo">QRAMS</div>
          <span className="adm-badge">Admin</span>
          <nav className="adm-subnav" style={{ border: "none", padding: "0", background: "transparent", marginLeft: "1rem" }}>
            <span className="adm-subnav-link adm-subnav-link--active">Dashboard</span>
            <Link to="/admin/events" className="adm-subnav-link">Events</Link>
            <Link to="/admin/users" className="adm-subnav-link">Users</Link>
            <Link to="/admin/profile" className="adm-subnav-link">Profile</Link>
          </nav>
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

        <div className="adm-stats">
          {statCards.map((stat) => (
            <div key={stat.label} className={`adm-stat ${stat.cls || ""}`}>
              <span className="adm-stat-num">{stat.val}</span>
              <span className="adm-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="adm-cards">
          {navCards.map((card) => (
            <Link key={card.label} to={card.to} className="adm-card">
              <div className="adm-card-icon">{card.icon}</div>
              <h3 className="adm-card-title">{card.label}</h3>
              <p className="adm-card-desc">{card.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
