import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout, getStoredUser, getUserDisplayName } from "../api/auth";
import {
  getAllEvents, createEvent, deleteEvent,
  type Event, type CreateEventPayload,
} from "../api/events";
import "./AdminLayout.css";

function AdminHeader({ onLogout, user }: { onLogout: () => void; user: ReturnType<typeof getStoredUser> }) {
  const displayName = getUserDisplayName(user);

  return (
    <header className="adm-header">
      <div className="adm-header-left">
        <div className="adm-logo">QR</div>
        <span className="adm-badge">Admin</span>
        <nav className="adm-subnav" style={{ border: "none", padding: "0", background: "transparent", marginLeft: "1rem" }}>
          <Link to="/admin/dashboard" className="adm-subnav-link">Dashboard</Link>
          <span className="adm-subnav-link adm-subnav-link--active">Events</span>
          <Link to="/admin/users" className="adm-subnav-link">Users</Link>
        </nav>
      </div>
      <div className="adm-header-right">
        {user && <span className="adm-greeting">{displayName}</span>}
        <button className="adm-signout" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  );
}

const EMPTY_FORM: CreateEventPayload = {
  title: "", description: "", date: "", start_time: "",
  end_time: "", location_name: "", latitude: null, longitude: null,
};

function statusClass(s: string) {
  const m: Record<string, string> = {
    upcoming: "adm-status--upcoming",
    active: "adm-status--active",
    past: "adm-status--past",
    deleted: "adm-status--deleted",
  };
  return m[s.toLowerCase()] || "";
}

export default function AdminEvents() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [events, setEvents] = useState<Event[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getAllEvents({ search, status: statusFilter })
      .then((d) => { setEvents(d.results || []); setCount(d.count || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await createEvent(form);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await deleteEvent(deleteId);
      setDeleteId(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const STATUS_TABS = ["", "upcoming", "active", "past"];

  return (
    <div className="adm-wrapper">
      <AdminHeader onLogout={handleLogout} user={user} />

      <main className="adm-main">
        <div className="adm-hero">
          <h1 className="adm-title">Events</h1>
          <p className="adm-sub">{count} event{count !== 1 ? "s" : ""} total</p>
        </div>

        {/* Controls */}
        <div className="adm-controls">
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {STATUS_TABS.map((s) => (
              <button
                key={s || "all"}
                className={`adm-btn adm-btn--sm ${statusFilter === s ? "adm-btn--primary" : "adm-btn--ghost"}`}
                onClick={() => setStatusFilter(s)}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div className="adm-search-wrap">
              <svg className="adm-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                className="adm-search"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="adm-btn adm-btn--primary" onClick={() => setShowCreate(true)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Create Event
            </button>
          </div>
        </div>

        {error && <div className="adm-error">{error}</div>}

        {/* Table */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="adm-th">Event</th>
                <th className="adm-th">Date</th>
                <th className="adm-th">Time</th>
                <th className="adm-th">Location</th>
                <th className="adm-th">Code</th>
                <th className="adm-th">Status</th>
                <th className="adm-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="adm-tr">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="adm-td"><div className="adm-skel adm-skel--wide" /></td>
                  ))}
                </tr>
              ))}
              {!loading && events.length === 0 && (
                <tr><td colSpan={7} className="adm-empty">No events found.</td></tr>
              )}
              {!loading && events.map((ev) => (
                <tr key={ev.id} className="adm-tr">
                  <td className="adm-td adm-td--bold" style={{ maxWidth: 200 }}>
                    <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {ev.title}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{ev.created_by.fullname}</span>
                  </td>
                  <td className="adm-td adm-td--muted">{ev.date}</td>
                  <td className="adm-td adm-td--muted" style={{ whiteSpace: "nowrap" }}>
                    {ev.start_time} – {ev.end_time}
                  </td>
                  <td className="adm-td adm-td--muted">{ev.location_name || "—"}</td>
                  <td className="adm-td">
                    <span style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#93c5fd" }}>
                      {ev.event_code}
                    </span>
                  </td>
                  <td className="adm-td">
                    <span className={`adm-status ${statusClass(ev.status)}`}>{ev.status}</span>
                  </td>
                  <td className="adm-td">
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Link
                        to={`/admin/events/${ev.id}`}
                        className="adm-btn adm-btn--ghost adm-btn--sm"
                      >
                        Manage
                      </Link>
                      <button
                        className="adm-btn adm-btn--danger adm-btn--sm"
                        onClick={() => setDeleteId(ev.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create Event Modal */}
      {showCreate && (
        <div className="adm-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="adm-modal-title">Create Event</h2>
            <form onSubmit={handleCreate}>
              {formError && <div className="adm-error">{formError}</div>}
              <div className="adm-field">
                <label className="adm-label">Title *</label>
                <input className="adm-input" placeholder="Event title" required
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="adm-field">
                <label className="adm-label">Description *</label>
                <textarea className="adm-input adm-textarea" placeholder="Describe the event" required
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="adm-field-row">
                <div className="adm-field">
                  <label className="adm-label">Date *</label>
                  <input className="adm-input" type="date" required
                    value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Location</label>
                  <input className="adm-input" placeholder="Venue name"
                    value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
                </div>
              </div>
              <div className="adm-field-row">
                <div className="adm-field">
                  <label className="adm-label">Start Time *</label>
                  <input className="adm-input" type="time" required
                    value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">End Time *</label>
                  <input className="adm-input" type="time" required
                    value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div className="adm-field-row">
                <div className="adm-field">
                  <label className="adm-label">Latitude (optional)</label>
                  <input className="adm-input" type="number" step="any" placeholder="e.g. 6.5244"
                    value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Longitude (optional)</label>
                  <input className="adm-input" type="number" step="any" placeholder="e.g. 3.3792"
                    value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div className="adm-modal-actions">
                <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="adm-btn adm-btn--primary" disabled={formLoading}>
                  {formLoading ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="adm-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="adm-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="adm-modal-title">Delete Event?</h2>
            <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
              This will soft-delete the event. It won't be visible to users but can be recovered from the database.
            </p>
            <div className="adm-modal-actions">
              <button className="adm-btn adm-btn--ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="adm-btn adm-btn--danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
