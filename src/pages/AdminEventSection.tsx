import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser, getUserDisplayName, logout } from "../api/auth";
import { getAllEvents, type Event } from "../api/events";
import "./AdminLayout.css";

type AdminSectionKind = "attendance" | "analytics" | "fraud";

const SECTION_COPY: Record<AdminSectionKind, { title: string; description: string; tab: "attendance" | "analytics" | "fraud" }> = {
  attendance: {
    title: "Attendance",
    description: "Open an event to see assigned users and attendance activity.",
    tab: "attendance",
  },
  analytics: {
    title: "Analytics",
    description: "Open an event to view scan totals, unique IPs, and session stats.",
    tab: "analytics",
  },
  fraud: {
    title: "Fraud Checks",
    description: "Open an event to inspect flagged scans and fraud log details.",
    tab: "fraud",
  },
};

function statusClass(status: string) {
  const map: Record<string, string> = {
    upcoming: "adm-status--upcoming",
    active: "adm-status--active",
    past: "adm-status--past",
    deleted: "adm-status--deleted",
  };

  return map[status.toLowerCase()] || "";
}

export default function AdminEventSection({ section }: { section: AdminSectionKind }) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const copy = SECTION_COPY[section];

  useEffect(() => {
    getAllEvents({ search })
      .then((data) => setEvents(data.results || []))
      .catch((err: Error) => setError(err.message || "Failed to load events."))
      .finally(() => setLoading(false));
  }, [search]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const emptyMessage = useMemo(() => {
    if (search.trim()) {
      return "No events matched your search.";
    }

    return "No events available yet.";
  }, [search]);

  return (
    <div className="adm-wrapper">
      <header className="adm-header">
        <div className="adm-header-left">
          <div className="adm-logo">QR</div>
          <span className="adm-badge">Admin</span>
          <nav className="adm-subnav" style={{ border: "none", padding: "0", background: "transparent", marginLeft: "1rem" }}>
            <Link to="/admin/dashboard" className="adm-subnav-link">Dashboard</Link>
            <Link to="/admin/events" className="adm-subnav-link">Events</Link>
            <Link to="/admin/users" className="adm-subnav-link">Users</Link>
            <span className="adm-subnav-link adm-subnav-link--active">{copy.title}</span>
          </nav>
        </div>
        <div className="adm-header-right">
          <span className="adm-greeting">{displayName}</span>
          <button className="adm-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-hero">
          <h1 className="adm-title">{copy.title}</h1>
          <p className="adm-sub">{copy.description}</p>
        </div>

        <div className="adm-controls">
          <p style={{ fontSize: 13, color: "#6b7280" }}>{events.length} event{events.length === 1 ? "" : "s"} ready for review</p>
          <div className="adm-search-wrap">
            <svg className="adm-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              className="adm-search"
              placeholder="Search events..."
              value={search}
              onChange={(e) => {
                setLoading(true);
                setError("");
                setSearch(e.target.value);
              }}
            />
          </div>
        </div>

        {error && <div className="adm-error">{error}</div>}

        <div className="adm-cards adm-cards--stack">
          {loading && Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="adm-card">
              <div className="adm-skel adm-skel--wide" style={{ height: 18, marginBottom: "0.875rem" }} />
              <div className="adm-skel" style={{ height: 12, marginBottom: "0.5rem" }} />
              <div className="adm-skel adm-skel--med" style={{ height: 12, marginBottom: "1rem" }} />
              <div className="adm-skel adm-skel--short" style={{ height: 28 }} />
            </div>
          ))}

          {!loading && !error && events.length === 0 && (
            <div className="adm-empty-card">{emptyMessage}</div>
          )}

          {!loading && !error && events.map((event) => (
            <div key={event.id} className="adm-card adm-card--row">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                  <h3 className="adm-card-title" style={{ marginBottom: 0 }}>{event.title}</h3>
                  <span className={`adm-status ${statusClass(event.status)}`}>{event.status}</span>
                </div>
                <p className="adm-card-desc" style={{ marginBottom: "0.625rem" }}>
                  {event.date} at {event.start_time} - {event.end_time}
                </p>
                <p className="adm-card-desc">
                  {event.location_name || "No location set"} . Created by {event.created_by.fullname}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Link to={`/admin/events/${event.id}?tab=${copy.tab}`} className="adm-btn adm-btn--primary">
                  Open {copy.title}
                </Link>
                <Link to={`/admin/events/${event.id}`} className="adm-btn adm-btn--ghost">
                  View Event
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
