import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyAttendance } from "../api/attendance";
import type { AttendanceRecord, AttendanceSummary, AttendanceStatus } from "../api/attendance";
import { getStoredUser, getUserDisplayName } from "../api/auth";
import "./Attendance.css";

type FilterTab = "all" | AttendanceStatus;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="att-tr att-tr--skeleton">
      <td className="att-td att-td--num">{index}</td>
      <td className="att-td" data-label="Event"><div className="skel skel--title" /></td>
      <td className="att-td" data-label="Date"><div className="skel skel--short" /></td>
      <td className="att-td" data-label="Check-in Time"><div className="skel skel--short" /></td>
      <td className="att-td" data-label="Location"><div className="skel skel--med" /></td>
      <td className="att-td" data-label="Status"><div className="skel skel--pill" /></td>
    </tr>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const isAdmin = user?.role === "admin" || user?.is_superuser || user?.is_staff;

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    getMyAttendance()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load attendance."))
      .finally(() => setLoading(false));
  }, [isAdmin, navigate]);

  const records = useMemo<AttendanceRecord[]>(
    () => (Array.isArray(data?.records) ? data.records : []),
    [data]
  );

  const filtered = useMemo<AttendanceRecord[]>(() => {
    if (!records.length) return [];
    let list = [...records];
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.event_name.toLowerCase().includes(q) ||
          (r.event_location ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
  }, [records, filter, search]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",      label: "All",      count: data?.total    ?? 0 },
    { key: "attended", label: "Attended", count: data?.attended ?? 0 },
    { key: "missed",   label: "Missed",   count: data?.missed   ?? 0 },
  ];

  return (
    <div className="att-wrapper">
      {/* ── Top nav ── */}
      <header className="att-nav">
        <div className="att-nav-left">
          <div className="att-nav-logo">QRAMS</div>
          <nav className="att-nav-links">
            <Link to="/dashboard" className="att-nav-link">Dashboard</Link>
            <span className="att-nav-link att-nav-link--active">Attendance</span>
            <Link to="/profile" className="att-nav-link">Profile</Link>
          </nav>
        </div>
        <div className="att-nav-right">
          <span className="att-nav-user">{displayName}</span>
        </div>
      </header>

      <main className="att-main">
        {/* ── Page title ── */}
        <div className="att-page-head">
          <div className="att-title-row">
            <h1 className="att-page-title">Attendance History</h1>
            {data && (
              <span className="att-event-count">{data.total} events</span>
            )}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="att-stats">
          <div className="att-stat">
            <span className="att-stat-num">{data?.total ?? "—"}</span>
            <span className="att-stat-label">Total Events</span>
          </div>
          <div className="att-stat att-stat--green">
            <span className="att-stat-num">{data?.attended ?? "—"}</span>
            <span className="att-stat-label">Attended</span>
          </div>
          <div className="att-stat att-stat--red">
            <span className="att-stat-num">{data?.missed ?? "—"}</span>
            <span className="att-stat-label">Missed</span>
          </div>
          <div className="att-stat">
            <span className="att-stat-num">
              {data && data.total > 0
                ? `${Math.round((data.attended / data.total) * 100)}%`
                : "—"}
            </span>
            <span className="att-stat-label">Rate</span>
          </div>
        </div>

        {/* ── Tabs + search ── */}
        <div className="att-controls">
          <div className="att-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`att-tab ${filter === t.key ? "att-tab--active" : ""}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
                <span className="att-tab-count">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="att-search-wrap">
            <svg className="att-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              className="att-search"
              type="text"
              placeholder="Search events or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Table ── */}
        {error && <div className="att-error">{error}</div>}

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th className="att-th att-th--num">#</th>
                <th className="att-th">Event</th>
                <th className="att-th">Date</th>
                <th className="att-th">Check-in Time</th>
                <th className="att-th">Location</th>
                <th className="att-th att-th--status">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} index={i + 1} />
                ))}

              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="att-empty">
                    {filter === "missed"
                      ? "No missed events — great work!"
                      : filter === "attended"
                      ? "No attended events yet."
                      : "No attendance records found."}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                filtered.map((record, i) => (
                  <tr key={record.id} className="att-tr">
                    <td className="att-td att-td--num">{i + 1}</td>
                    <td className="att-td att-td--name" data-label="Event">{record.event_name}</td>
                    <td className="att-td att-td--muted" data-label="Date">{formatDate(record.event_date)}</td>
                    <td className="att-td att-td--muted" data-label="Check-in Time">
                      {record.marked_at && record.status === "attended"
                        ? formatTime(record.marked_at)
                        : "—"}
                    </td>
                    <td className="att-td att-td--muted" data-label="Location">
                      {record.event_location || "—"}
                    </td>
                    <td className="att-td att-td--status" data-label="Status">
                      <span className={`att-badge att-badge--${record.status}`}>
                        {record.status === "attended" ? "Present" : "Absent"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
