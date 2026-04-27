import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout, getStoredUser, getUserDisplayName } from "../api/auth";
import {
  getAllEventsList, createEvent, deleteEvent,
  type Event, type CreateEventPayload,
} from "../api/events";
import "./AdminLayout.css";

interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ng");
  url.searchParams.set("bounded", "1");
  url.searchParams.set("viewbox", "2.6680,13.8920,14.6780,4.2400");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Could not search locations right now.");
  }

  return await response.json() as LocationSuggestion[];
}

async function reverseGeocode(latitude: number, longitude: number): Promise<LocationSuggestion> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Could not verify your current location.");
  }

  const data = await response.json() as { place_id?: number; display_name?: string; lat?: string; lon?: string };
  return {
    place_id: data.place_id || 0,
    display_name: data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    lat: data.lat || String(latitude),
    lon: data.lon || String(longitude),
  };
}

function AdminHeader({ onLogout, user }: { onLogout: () => void; user: ReturnType<typeof getStoredUser> }) {
  const displayName = getUserDisplayName(user);

  return (
    <header className="adm-header">
      <div className="adm-header-left">
        <div className="adm-logo">QRAMS</div>
        <span className="adm-badge">Admin</span>
        <nav className="adm-subnav" style={{ border: "none", padding: "0", background: "transparent", marginLeft: "1rem" }}>
          <Link to="/admin/dashboard" className="adm-subnav-link">Dashboard</Link>
          <span className="adm-subnav-link adm-subnav-link--active">Events</span>
          <Link to="/admin/users" className="adm-subnav-link">Users</Link>
          <Link to="/admin/profile" className="adm-subnav-link">Profile</Link>
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
  const isSuperuser = user?.is_superuser === true;

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
  const [locationQuery, setLocationQuery] = useState("");
  const [locationMatches, setLocationMatches] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getAllEventsList({ search, status: statusFilter })
      .then((results) => { setEvents(results || []); setCount(results.length || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const closeCreateModal = () => {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setFormError("");
    setLocationQuery("");
    setLocationMatches([]);
    setLocationError("");
  };

  useEffect(() => {
    if (!showCreate) {
      return;
    }

    const query = locationQuery.trim();
    if (query.length < 3) {
      setLocationMatches([]);
      setLocationError("");
      return;
    }

    let cancelled = false;
    setLocationLoading(true);
    setLocationError("");

    const timer = window.setTimeout(() => {
      searchLocations(query)
        .then((results) => {
          if (!cancelled) {
            setLocationMatches(results);
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            setLocationMatches([]);
            setLocationError(err.message || "Could not search locations.");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLocationLoading(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [locationQuery, showCreate]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const applyLocationSuggestion = (suggestion: LocationSuggestion) => {
    setForm((current) => ({
      ...current,
      location_name: suggestion.display_name,
      latitude: Number(suggestion.lat),
      longitude: Number(suggestion.lon),
    }));
    setLocationQuery(suggestion.display_name);
    setLocationMatches([]);
    setLocationError("");
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location detection is unavailable in this browser.");
      return;
    }

    setLocationLoading(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const suggestion = await reverseGeocode(coords.latitude, coords.longitude);
          applyLocationSuggestion(suggestion);
        } catch (err) {
          setLocationError(err instanceof Error ? err.message : "Could not verify your current location.");
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setLocationError("Allow location access to use your current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      if (form.location_name && (form.latitude == null || form.longitude == null)) {
        throw new Error("Select a real location suggestion or use your current location so latitude and longitude are saved.");
      }

      await createEvent(form);
      closeCreateModal();
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

  const STATUS_TABS = ["", "upcoming", "active", "past", ...(isSuperuser ? ["deleted"] : [])];

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
        <div className="adm-modal-overlay" onClick={closeCreateModal}>
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
                  <div className="adm-location-wrap">
                    <input
                      className="adm-input"
                      placeholder="Search for a real venue or address"
                      value={locationQuery}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setLocationQuery(nextValue);
                        setLocationError("");
                        setForm((current) => ({
                          ...current,
                          location_name: nextValue,
                          latitude: null,
                          longitude: null,
                        }));
                      }}
                    />
                    <button
                      type="button"
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      onClick={handleUseCurrentLocation}
                      disabled={locationLoading}
                    >
                      {locationLoading ? "Finding..." : "Use current location"}
                    </button>
                    {locationError && <p className="adm-location-help adm-location-help--error">{locationError}</p>}
                    {!locationError && (
                      <p className="adm-location-help">
                        Pick a matching place so the event keeps a verified location and coordinates.
                      </p>
                    )}
                    {locationMatches.length > 0 && (
                      <div className="adm-location-results">
                        {locationMatches.map((suggestion) => (
                          <button
                            key={suggestion.place_id}
                            type="button"
                            className="adm-location-option"
                            onClick={() => applyLocationSuggestion(suggestion)}
                          >
                            {suggestion.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                <button type="button" className="adm-btn adm-btn--ghost" onClick={closeCreateModal}>
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
              {isSuperuser
                ? "This will soft-delete the event. It won't be visible to users but can be recovered from the database."
                : "Are you sure you want to delete?"}
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
