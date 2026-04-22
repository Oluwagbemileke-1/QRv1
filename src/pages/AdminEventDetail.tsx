import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { logout, getStoredUser, getUserDisplayName, listUsers, type UserProfile } from "../api/auth";
import {
  getEventDetail, generateEventQr, getEventAttendees, updateEvent,
  assignUsers, previewAssign, type Event, type EventAttendee, type AssignPreview,
} from "../api/events";
import {
  generateQr,
  getEventStats,
  getFraudLogs,
  getAllScans,
  getSuccessfulScans,
  type EventStats,
  type FraudLog,
  type ScanAttempt,
} from "../api/dotnet";
import "./AdminLayout.css";

type Tab = "overview" | "qr" | "attendance" | "analytics" | "fraud";

function TabBtn({ id, active, onClick, children }: { id: Tab; active: Tab; onClick: (t: Tab) => void; children: React.ReactNode }) {
  return (
    <button
      className={`adm-subnav-link ${active === id ? "adm-subnav-link--active" : ""}`}
      style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
      onClick={() => onClick(id)}
    >
      {children}
    </button>
  );
}

export default function AdminEventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const isTab = (value: string | null): value is Tab =>
    value === "overview" || value === "qr" || value === "attendance" || value === "analytics" || value === "fraud";
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "overview");

  // Event
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
    location_name: "",
  });

  // QR
  const [qrData, setQrData] = useState<{
    imageUrl: string;
    expiresAt: string;
    generatedAt?: string;
    checkInUrl?: string;
    eventCode?: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshingRef = useRef(false);
  const scanBaselineRef = useRef<number | null>(null);

  // Attendance (Django)
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendeeLoading, setAttendeeLoading] = useState(false);

  // Assign users
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<UserProfile[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSummary, setInviteSummary] = useState({ totalFetched: 0, attendeeFiltered: 0 });
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");
  const [assignError, setAssignError] = useState("");

  // Analytics (.NET)
  const [stats, setStats] = useState<EventStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  // Scans (.NET)
  const [scans, setScans] = useState<ScanAttempt[]>([]);
  const [scansLoading, setScansLoading] = useState(false);
  const [scansError, setScansError] = useState("");
  const [successfulScans, setSuccessfulScans] = useState<ScanAttempt[]>([]);
  const [successfulScansLoading, setSuccessfulScansLoading] = useState(false);
  const [successfulScansError, setSuccessfulScansError] = useState("");

  // Fraud (.NET)
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudError, setFraudError] = useState("");

  const handleLogout = async () => { await logout(); navigate("/login"); };

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (isTab(requestedTab) && requestedTab !== tab) {
      setTab(requestedTab);
    }
  }, [searchParams, tab]);

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("tab", nextTab);
      return params;
    });
  };

  // Load event
  useEffect(() => {
    if (!eventId) return;
    getEventDetail(eventId)
      .then((d) => setEvent(d.data))
      .catch((e) => setEventError(e.message))
      .finally(() => setEventLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!event) return;

    const toDateInput = (value: string) => {
      const parts = value.split("-");
      if (parts.length !== 3) return value;
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    };

    const toTimeInput = (value: string) => {
      const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return value;
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const meridiem = match[3].toUpperCase();

      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      return `${String(hours).padStart(2, "0")}:${minutes}`;
    };

    setEditForm({
      title: event.title,
      description: event.description,
      date: toDateInput(event.date),
      start_time: toTimeInput(event.start_time),
      end_time: toTimeInput(event.end_time),
      location_name: event.location_name || "",
    });
  }, [event]);

  // Load attendees when tab opens
  useEffect(() => {
    if (tab !== "attendance" || !eventId) return;
    setAttendeeLoading(true);
    getEventAttendees(eventId, { search: attendeeSearch })
      .then((d) => setAttendees(d.results?.attendees || []))
      .catch(() => {})
      .finally(() => setAttendeeLoading(false));
  }, [tab, eventId, attendeeSearch]);

  useEffect(() => {
    if (tab !== "attendance" || !eventId) return;
    setSuccessfulScansLoading(true);
    setSuccessfulScansError("");
    getSuccessfulScans(eventId)
      .then(setSuccessfulScans)
      .catch((err: Error) => setSuccessfulScansError(err.message || "Could not load successful scans."))
      .finally(() => setSuccessfulScansLoading(false));
  }, [tab, eventId]);

  useEffect(() => {
    if (tab !== "attendance") return;
    setInviteLoading(true);
    setInviteError("");

    listUsers(inviteSearch)
      .then((data) => {
        const eventAttendeeIds = new Set(attendees.map((attendee) => attendee.id));
        let attendeeFiltered = 0;

        const candidates = (data.results || []).filter((candidate) => {
          const alreadyAssigned = eventAttendeeIds.has(candidate.id);

          if (alreadyAssigned) {
            attendeeFiltered += 1;
            return false;
          }

          return true;
        });

        setInviteSummary({
          totalFetched: data.results?.length || 0,
          attendeeFiltered,
        });
        setInviteCandidates(candidates);
      })
      .catch((err: Error) => {
        setInviteError(err.message || "Could not load users to invite.");
        setInviteSummary({ totalFetched: 0, attendeeFiltered: 0 });
        setInviteCandidates([]);
      })
      .finally(() => setInviteLoading(false));
  }, [tab, inviteSearch, attendees]);

  // Load analytics when tab opens
  useEffect(() => {
    if (tab !== "analytics" || !eventId) return;
    setStatsLoading(true);
    setScansLoading(true);
    setScansError("");
    getEventStats(eventId)
      .then(setStats)
      .catch((e) => setStatsError(e.message))
      .finally(() => setStatsLoading(false));
    getAllScans(eventId)
      .then(setScans)
      .catch((e: Error) => setScansError(e.message || "Could not load scan attempts."))
      .finally(() => setScansLoading(false));
  }, [tab, eventId]);

  // Load fraud when tab opens
  useEffect(() => {
    if (tab !== "fraud" || !eventId) return;
    setFraudLoading(true);
    getFraudLogs(eventId)
      .then(setFraudLogs)
      .catch((e) => setFraudError(e.message))
      .finally(() => setFraudLoading(false));
  }, [tab, eventId]);

  // QR countdown timer
  const clearQrTimers = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (scanWatchRef.current) clearInterval(scanWatchRef.current);
  };

  const startCountdown = () => {
    clearQrTimers();

    const deadline = Date.now() + 60000;

    const tick = () => {
      const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(secs);
      if (secs <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        setQrData(null);
        if (tab === "qr") {
          void handleGenerateQr("expired");
        }
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  };

  const startScanWatcher = (eventIdValue: string) => {
    if (scanWatchRef.current) {
      clearInterval(scanWatchRef.current);
    }

    scanWatchRef.current = setInterval(async () => {
      if (qrRefreshingRef.current || tab !== "qr") {
        return;
      }

      try {
        const result = await getEventStats(eventIdValue);
        const currentCount = result.totalScans ?? 0;

        if (scanBaselineRef.current == null) {
          scanBaselineRef.current = currentCount;
          return;
        }

        if (currentCount > scanBaselineRef.current) {
          scanBaselineRef.current = currentCount;
          void handleGenerateQr("scanned");
        }
      } catch {
        // Keep the current QR visible even if the scan count poll fails temporarily.
      }
    }, 1000);
  };

  const handleGenerateQr = async (reason: "manual" | "expired" | "scanned" = "manual") => {
    if (!eventId || !event) return;

    if (event.status.toLowerCase() === "past" || event.status.toLowerCase() === "deleted") {
      setQrError("You cannot generate a QR code for a past or deleted event.");
      setQrData(null);
      clearQrTimers();
      return;
    }

    if (qrRefreshingRef.current) {
      return;
    }

    qrRefreshingRef.current = true;
    setQrLoading(true);
    setQrError(reason === "manual" ? "" : qrError);
    try {
      let imageUrl = "";
      let expiresAt = "";
      let generatedAt = "";
      let checkInUrl = "";
      let eventCode = "";

      try {
        const res = await generateEventQr(eventId);
        imageUrl = res.data?.imageUrl || "";
        expiresAt = res.data?.expiresAt || "";
        generatedAt = res.data?.generatedAt || "";
        checkInUrl = res.check_in_url || "";
        eventCode = res.event_code || event.event_code;
      } catch {
        const fallback = await generateQr(eventId, event.event_code);
        imageUrl = fallback.imageUrl;
        expiresAt = fallback.expiresAt;
        generatedAt = fallback.generatedAt;
        eventCode = event.event_code;
      }

      if (!imageUrl || !expiresAt) {
        throw new Error("QR service did not return an image yet.");
      }

      setQrData({ imageUrl, expiresAt, generatedAt, checkInUrl, eventCode });
      startCountdown();
      try {
        const result = await getEventStats(eventId);
        scanBaselineRef.current = result.totalScans ?? 0;
      } catch {
        scanBaselineRef.current = null;
      }
      startScanWatcher(eventId);
    } catch (err: unknown) {
      setQrError(err instanceof Error ? err.message : "Failed to generate QR.");
    } finally {
      setQrLoading(false);
      qrRefreshingRef.current = false;
    }
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditError("");
    setEditMsg("");
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleUpdateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!eventId || !event) return;

    setEditLoading(true);
    setEditError("");
    setEditMsg("");

    try {
      const response = await updateEvent(eventId, {
        title: editForm.title,
        description: editForm.description,
        date: editForm.date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        location_name: editForm.location_name,
      });

      setEvent((current) => (current ? { ...current, ...response.data } : response.data));
      setEditMsg(response.message || "Event updated successfully.");
      setShowEditForm(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update event.");
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      clearQrTimers();
    };
  }, []);

  useEffect(() => {
    if (tab !== "qr") {
      clearQrTimers();
    }
  }, [tab]);

  // Assign users
  const selectedUserIds = selectedUsers.map((user) => user.id);

  const toggleSelectedUser = (candidate: UserProfile) => {
    setAssignMsg("");
    setPreview(null);
    setSelectedUsers((current) =>
      current.some((user) => user.id === candidate.id)
        ? current.filter((user) => user.id !== candidate.id)
        : [...current, candidate]
    );
  };

  const handlePreview = async () => {
    if (!eventId || selectedUserIds.length === 0) return;
    setAssignLoading(true);
    setAssignError("");
    setPreview(null);
    try {
      const p = await previewAssign(eventId, selectedUserIds);
      setPreview(p);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!eventId || selectedUserIds.length === 0) return;
    setAssignLoading(true);
    setAssignError("");
    try {
      const res = await assignUsers(eventId, selectedUserIds, true);
      setAssignMsg(res.message);
      setPreview(null);
      setSelectedUsers([]);
      const refreshed = await getEventAttendees(eventId, { search: attendeeSearch });
      setAttendees(refreshed.results?.attendees || []);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setAssignLoading(false);
    }
  };

  if (eventLoading) return (
    <div className="adm-wrapper">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#6b7280" }}>
        Loading event...
      </div>
    </div>
  );

  if (eventError || !event) return (
    <div className="adm-wrapper">
      <div style={{ padding: "3rem", textAlign: "center", color: "#fca5a5" }}>
        {eventError || "Event not found."}
        <br /><Link to="/admin/events" className="adm-back" style={{ marginTop: "1rem", display: "inline-flex" }}>← Back to events</Link>
      </div>
    </div>
  );

  return (
    <div className="adm-wrapper">
      {/* Header */}
      <header className="adm-header">
        <div className="adm-header-left">
          <div className="adm-logo">QR</div>
          <span className="adm-badge">Admin</span>
        </div>
        <div className="adm-header-right">
          {user && <span className="adm-greeting">{displayName}</span>}
          <button className="adm-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="adm-subnav">
        <Link to="/admin/events" className="adm-subnav-link">← Events</Link>
        {(["overview", "qr", "attendance", "analytics", "fraud"] as Tab[]).map((t) => (
          <TabBtn key={t} id={t} active={tab} onClick={handleTabChange}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </TabBtn>
        ))}
      </div>

      <main className="adm-main">
        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <>
            <div className="adm-hero">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <h1 className="adm-title" style={{ margin: 0 }}>{event.title}</h1>
                <span className={`adm-status adm-status--${event.status.toLowerCase()}`}>{event.status}</span>
              </div>
              <p className="adm-sub">{event.description}</p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <button
                className="adm-btn adm-btn--primary"
                onClick={() => {
                  setShowEditForm((current) => !current);
                  setEditError("");
                  setEditMsg("");
                }}
              >
                {showEditForm ? "Close Edit" : "Edit Event"}
              </button>
              {editMsg && (
                <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", fontSize: 13, borderRadius: 10, padding: "10px 14px" }}>
                  {editMsg}
                </div>
              )}
            </div>
            {showEditForm && (
              <form
                onSubmit={handleUpdateEvent}
                style={{ background: "#111316", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "1.25rem", marginBottom: "1.25rem" }}
              >
                {editError && <div className="adm-error" style={{ marginBottom: "0.875rem" }}>{editError}</div>}
                <div className="adm-field">
                  <label className="adm-label">Title</label>
                  <input className="adm-input" name="title" value={editForm.title} onChange={handleEditChange} required />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Description</label>
                  <textarea className="adm-input adm-textarea" name="description" value={editForm.description} onChange={handleEditChange} required />
                </div>
                <div className="adm-field-row">
                  <div className="adm-field">
                    <label className="adm-label">Date</label>
                    <input className="adm-input" type="date" name="date" value={editForm.date} onChange={handleEditChange} required />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label">Location</label>
                    <input className="adm-input" name="location_name" value={editForm.location_name} onChange={handleEditChange} />
                  </div>
                </div>
                <div className="adm-field-row">
                  <div className="adm-field">
                    <label className="adm-label">Start Time</label>
                    <input className="adm-input" type="time" name="start_time" value={editForm.start_time} onChange={handleEditChange} required />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label">End Time</label>
                    <input className="adm-input" type="time" name="end_time" value={editForm.end_time} onChange={handleEditChange} required />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <button type="submit" className="adm-btn adm-btn--primary" disabled={editLoading}>
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost"
                    onClick={() => setShowEditForm(false)}
                    disabled={editLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div className="adm-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              <div className="adm-stat">
                <span className="adm-stat-num" style={{ fontSize: 16 }}>{event.date}</span>
                <span className="adm-stat-label">Date</span>
              </div>
              <div className="adm-stat">
                <span className="adm-stat-num" style={{ fontSize: 16 }}>{event.start_time} – {event.end_time}</span>
                <span className="adm-stat-label">Time</span>
              </div>
              <div className="adm-stat">
                <span className="adm-stat-num" style={{ fontSize: 16 }}>{event.location_name || "—"}</span>
                <span className="adm-stat-label">Location</span>
              </div>
            </div>
            <div className="adm-stat" style={{ marginTop: "0.875rem", display: "inline-block" }}>
              <span className="adm-stat-label">Event Code</span>
              <span style={{ display: "block", fontFamily: "DM Mono, monospace", fontSize: 24, color: "#93c5fd", marginTop: 4 }}>
                {event.event_code}
              </span>
            </div>
          </>
        )}

        {/* ── QR tab ── */}
        {tab === "qr" && (
          <div className="adm-qr-panel">
            <div className="adm-hero">
              <h2 className="adm-title">Generate QR Code</h2>
            </div>

            {qrError && <div className="adm-error">{qrError}</div>}

            <button
              className="adm-btn adm-btn--primary"
              onClick={() => void handleGenerateQr("manual")}
              disabled={qrLoading || event.status.toLowerCase() === "past" || event.status.toLowerCase() === "deleted"}
            >
              {qrLoading ? "Generating..." : qrData ? "Regenerate QR" : "Generate QR"}
            </button>
            {(event.status.toLowerCase() === "past" || event.status.toLowerCase() === "deleted") && (
              <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 10 }}>
                QR generation is disabled for past or deleted events.
              </p>
            )}

            {qrData && (
              <div className="adm-qr-stage">
                <div className="adm-qr-box">
                  <img src={qrData.imageUrl} alt="QR Code" className="adm-qr-img" />
                </div>
                <div style={{ marginTop: "1rem" }}>
                  <span className="adm-stat-label">Expires in</span>
                  <div className="adm-qr-countdown" style={{ fontSize: 28, marginTop: 4 }}>
                    {Math.floor(countdown / 60).toString().padStart(2, "0")}:{(countdown % 60).toString().padStart(2, "0")}
                  </div>
                  {countdown <= 10 && countdown > 0 && (
                    <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 4 }}>Expiring soon — regenerate if not yet scanned</p>
                  )}
                  {countdown === 0 && (
                    <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 4 }}>QR expired. Generate a new one.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance tab ── */}
        {tab === "attendance" && (
          <>
            <div className="adm-hero">
              <h2 className="adm-title">Attendees</h2>
              <p className="adm-sub">Search users, select who to invite, preview the assignment, then send the invite.</p>
            </div>

            {/* Assign users */}
            <div style={{ background: "#111316", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#d1d5db", marginBottom: "0.75rem" }}>Invite Users</p>
              {assignError && <div className="adm-error" style={{ marginBottom: "0.75rem" }}>{assignError}</div>}
              {inviteError && <div className="adm-error" style={{ marginBottom: "0.75rem" }}>{inviteError}</div>}
              {assignMsg && <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", fontSize: 13, borderRadius: 10, padding: "10px 14px", marginBottom: "0.75rem" }}>{assignMsg}</div>}
              <div style={{ display: "grid", gap: "1rem" }}>
                <div className="adm-search-wrap">
                  <svg className="adm-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <input
                    className="adm-search"
                    style={{ width: "100%" }}
                    placeholder="Search users by username, email, or name..."
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                  />
                </div>

                {selectedUsers.length > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {selectedUsers.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className="adm-btn adm-btn--ghost adm-btn--sm"
                        onClick={() => toggleSelectedUser(candidate)}
                      >
                        {candidate.username} ×
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                  {inviteLoading && (
                    <div style={{ padding: "1rem", color: "#6b7280", fontSize: 13 }}>Loading users...</div>
                  )}
                  {!inviteLoading && inviteCandidates.length === 0 && (
                    <div style={{ padding: "1rem", color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>
                      {inviteSummary.totalFetched === 0
                        ? "The backend returned no users for invites."
                        : "No inviteable users left in this result."}
                      <br />
                      Fetched: {inviteSummary.totalFetched}, already assigned: {inviteSummary.attendeeFiltered}.
                    </div>
                  )}
                  {!inviteLoading && inviteCandidates.slice(0, 8).map((candidate) => {
                    const isSelected = selectedUsers.some((user) => user.id === candidate.id);

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => toggleSelectedUser(candidate)}
                        style={{
                          width: "100%",
                          background: isSelected ? "rgba(37,99,235,0.12)" : "transparent",
                          color: "#d1d5db",
                          border: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          padding: "0.875rem 1rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span>
                          <span style={{ display: "block", fontWeight: 500 }}>{candidate.username}</span>
                          <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
                            {[candidate.first_name, candidate.last_name].filter(Boolean).join(" ") || candidate.email}
                          </span>
                        </span>
                        <span style={{ color: isSelected ? "#93c5fd" : "#6b7280", fontSize: 12 }}>
                          {isSelected ? "Selected" : "Invite"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button className="adm-btn adm-btn--ghost" onClick={handlePreview} disabled={assignLoading || selectedUserIds.length === 0}>
                  Preview
                  </button>
                  {preview && (
                    <button className="adm-btn adm-btn--primary" onClick={handleConfirmAssign} disabled={assignLoading}>
                      Send Invite
                    </button>
                  )}
                </div>
              </div>
              {preview && (
                <div style={{ marginTop: "0.875rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#86efac" }}>Will be added: {preview.summary.will_receive_email}</span>
                  <span style={{ fontSize: 12, color: "#93c5fd" }}>Already assigned: {preview.summary.already_assigned}</span>
                  <span style={{ fontSize: 12, color: "#fca5a5" }}>Invalid IDs: {preview.summary.invalid_ids}</span>
                </div>
              )}
            </div>

            {/* Attendees search */}
            <div className="adm-controls">
              <p style={{ fontSize: 13, color: "#6b7280" }}>{attendees.length} assigned</p>
              <div className="adm-search-wrap">
                <svg className="adm-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <input className="adm-search" placeholder="Search attendees..." value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)} />
              </div>
            </div>

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="adm-th">Name</th>
                    <th className="adm-th">Username</th>
                    <th className="adm-th">Email</th>
                    <th className="adm-th">Phone</th>
                    <th className="adm-th">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {attendeeLoading && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="adm-tr">
                      {Array.from({ length: 5 }).map((__, j) => <td key={j} className="adm-td"><div className="adm-skel" /></td>)}
                    </tr>
                  ))}
                  {!attendeeLoading && attendees.length === 0 && (
                    <tr><td colSpan={5} className="adm-empty">No attendees assigned yet.</td></tr>
                  )}
                  {!attendeeLoading && attendees.map((a) => (
                    <tr key={a.id} className="adm-tr">
                      <td className="adm-td adm-td--bold">{a.first_name} {a.last_name}</td>
                      <td className="adm-td adm-td--muted">{a.username}</td>
                      <td className="adm-td adm-td--muted">{a.email}</td>
                      <td className="adm-td adm-td--muted">{a.phone || "-"}</td>
                      <td className="adm-td">
                        <span className={`adm-status ${a.role === "admin" ? "adm-status--upcoming" : "adm-status--past"}`}>
                          {a.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 500, color: "#d1d5db", margin: "1.5rem 0 0.875rem" }}>Users Who Successfully Checked In</h3>
            {successfulScansError && <div className="adm-error" style={{ marginBottom: "0.875rem" }}>{successfulScansError}</div>}
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="adm-th">Username</th>
                    <th className="adm-th">Invited User</th>
                    <th className="adm-th">Email</th>
                    <th className="adm-th">Location</th>
                    <th className="adm-th">Scanned At</th>
                  </tr>
                </thead>
                <tbody>
                  {successfulScansLoading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="adm-tr">
                      {Array.from({ length: 5 }).map((__, j) => <td key={j} className="adm-td"><div className="adm-skel" /></td>)}
                    </tr>
                  ))}
                  {!successfulScansLoading && successfulScans.length === 0 && (
                    <tr><td colSpan={5} className="adm-empty">No successful check-ins recorded yet.</td></tr>
                  )}
                  {!successfulScansLoading && successfulScans.map((scan, index) => {
                    const invitedUser = attendees.find((attendee) => attendee.username.toLowerCase() === scan.username.toLowerCase());

                    return (
                      <tr key={`${scan.username}-${scan.scannedAt}-${index}`} className="adm-tr">
                        <td className="adm-td adm-td--bold">{scan.username}</td>
                        <td className="adm-td adm-td--muted">
                          {invitedUser ? `${invitedUser.first_name} ${invitedUser.last_name}`.trim() || invitedUser.username : "Not in invited list"}
                        </td>
                        <td className="adm-td adm-td--muted">{invitedUser?.email || "-"}</td>
                        <td className="adm-td adm-td--muted">{scan.location || "-"}</td>
                        <td className="adm-td adm-td--muted">{new Date(scan.scannedAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Analytics tab ── */}
        {tab === "analytics" && (
          <>
            <div className="adm-hero">
              <h2 className="adm-title">Analytics</h2>
              <p className="adm-sub">Scan data from the .NET API for this event.</p>
            </div>
            {statsError && <div className="adm-error">{statsError}</div>}
            {scansError && <div className="adm-error">{scansError}</div>}
            {statsLoading ? (
              <div className="adm-stats">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="adm-stat"><div className="adm-skel adm-skel--wide" style={{ height: 30 }} /></div>
                ))}
              </div>
            ) : stats && (
              <div className="adm-stats">
                <div className="adm-stat"><span className="adm-stat-num">{stats.totalScans}</span><span className="adm-stat-label">Total Scans</span></div>
                <div className="adm-stat adm-stat--green"><span className="adm-stat-num">{stats.successfulScans}</span><span className="adm-stat-label">Successful</span></div>
                <div className="adm-stat adm-stat--red"><span className="adm-stat-num">{stats.fraudAttempts}</span><span className="adm-stat-label">Fraud Attempts</span></div>
                <div className="adm-stat adm-stat--blue"><span className="adm-stat-num">{stats.uniqueIps}</span><span className="adm-stat-label">Unique IPs</span></div>
              </div>
            )}

            {/* All scans table */}
            <h3 style={{ fontSize: 15, fontWeight: 500, color: "#d1d5db", margin: "1.5rem 0 0.875rem" }}>All Scan Attempts</h3>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="adm-th">Username</th>
                    <th className="adm-th">Result</th>
                    <th className="adm-th">IP Address</th>
                    <th className="adm-th">Location</th>
                    <th className="adm-th">Scanned At</th>
                  </tr>
                </thead>
                <tbody>
                  {scansLoading && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="adm-tr">
                      {Array.from({ length: 5 }).map((__, j) => <td key={j} className="adm-td"><div className="adm-skel" /></td>)}
                    </tr>
                  ))}
                  {!scansLoading && scans.length === 0 && (
                    <tr><td colSpan={5} className="adm-empty">No scans recorded yet.</td></tr>
                  )}
                  {!scansLoading && scans.map((s, i) => (
                    <tr key={i} className="adm-tr">
                      <td className="adm-td adm-td--bold">{s.username}</td>
                      <td className="adm-td">
                        <span className={`adm-status adm-status--${s.result.toLowerCase()}`}>{s.result}</span>
                      </td>
                      <td className="adm-td adm-td--muted" style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}>{s.ipAddress}</td>
                      <td className="adm-td adm-td--muted">{s.location || "-"}</td>
                      <td className="adm-td adm-td--muted">{new Date(s.scannedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Fraud tab ── */}
        {tab === "fraud" && (
          <>
            <div className="adm-hero">
              <h2 className="adm-title">Fraud Logs</h2>
              <p className="adm-sub">All flagged scan attempts detected by the fraud system.</p>
            </div>
            {fraudError && <div className="adm-error">{fraudError}</div>}
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="adm-th">Username</th>
                    <th className="adm-th">Reason</th>
                    <th className="adm-th">Details</th>
                    <th className="adm-th">IP</th>
                    <th className="adm-th">Detected At</th>
                  </tr>
                </thead>
                <tbody>
                  {fraudLoading && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="adm-tr">
                      {Array.from({ length: 5 }).map((__, j) => <td key={j} className="adm-td"><div className="adm-skel" /></td>)}
                    </tr>
                  ))}
                  {!fraudLoading && fraudLogs.length === 0 && (
                    <tr><td colSpan={5} className="adm-empty">No fraud detected for this event.</td></tr>
                  )}
                  {!fraudLoading && fraudLogs.map((f, i) => (
                    <tr key={i} className="adm-tr">
                      <td className="adm-td adm-td--bold">{f.username}</td>
                      <td className="adm-td">
                        <span className="adm-status adm-status--fraud">{f.reason}</span>
                      </td>
                      <td className="adm-td adm-td--muted" style={{ maxWidth: 240, whiteSpace: "normal", fontSize: 12 }}>{f.details || "-"}</td>
                      <td className="adm-td adm-td--muted" style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}>{f.ipAddress}</td>
                      <td className="adm-td adm-td--muted">{new Date(f.detectedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
