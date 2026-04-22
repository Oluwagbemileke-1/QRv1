import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser, getUserDisplayName } from "../api/auth";
import { getMyAttendance } from "../api/attendance";
import { getMyEvents, type Event, type UserEventGroups } from "../api/events";
import "./Dashboard.css";

function EventRow({ event, actionLabel, actionTo }: { event: Event; actionLabel: string; actionTo?: string }) {
  return (
    <div className="dash-event-row">
      <div>
        <p className="dash-event-title">{event.title}</p>
        <p className="dash-event-meta">
          {event.date} . {event.start_time} - {event.end_time} . {event.location_name || "No location yet"}
        </p>
      </div>
      {actionTo ? (
        <Link to={actionTo} className="dash-event-action">{actionLabel}</Link>
      ) : (
        <span className="dash-event-chip">{actionLabel}</span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const isAdmin = user?.role === "admin" || user?.is_superuser || user?.is_staff;
  const [events, setEvents] = useState<UserEventGroups>({ upcoming: [], active: [], past: [] });
  const [attendance, setAttendance] = useState({ total: 0, attended: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    Promise.all([getMyEvents(), getMyAttendance()])
      .then(([eventGroups, attendanceSummary]) => {
        setEvents(eventGroups);
        setAttendance({
          total: attendanceSummary.total,
          attended: attendanceSummary.attended,
          missed: attendanceSummary.missed,
        });
      })
      .catch((err: Error) => setError(err.message || "Failed to load your dashboard."))
      .finally(() => setLoading(false));
  }, [isAdmin, navigate]);

  const invitedCount = useMemo(
    () => events.upcoming.length + events.active.length + events.past.length,
    [events]
  );

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-logo">QR</div>
          <nav className="dash-nav">
            <span className="dash-nav-link dash-nav-link--active">Dashboard</span>
            <Link to="/attendance" className="dash-nav-link">Attendance</Link>
            <Link to="/profile" className="dash-nav-link">Profile</Link>
          </nav>
        </div>
        <div className="dash-user">
          <span className="dash-greeting">{displayName}</span>
        </div>
      </header>

      <main className="dash-main dash-main--wide">
        <section className="dash-hero">
          <h1 className="dash-welcome">Your event space</h1>
          <p className="dash-caption">
            Track invited events, see what you attended or missed, and use your event QR when it is time to check in.
          </p>
          <div className="dash-hero-actions">
            <Link to="/attendance" className="dash-hero-btn dash-hero-btn--primary">Open attendance</Link>
            <Link to="/profile" className="dash-hero-btn dash-hero-btn--ghost">View profile</Link>
            <span className="dash-hero-note">Check-in only works from a scanned event QR.</span>
          </div>
        </section>

        {error && <div className="dash-error">{error}</div>}

        <section className="dash-stats">
          <div className="dash-stat">
            <span className="dash-stat-num">{loading ? "-" : invitedCount}</span>
            <span className="dash-stat-label">Invited Events</span>
          </div>
          <div className="dash-stat dash-stat--blue">
            <span className="dash-stat-num">{loading ? "-" : events.upcoming.length}</span>
            <span className="dash-stat-label">Upcoming</span>
          </div>
          <div className="dash-stat dash-stat--green">
            <span className="dash-stat-num">{loading ? "-" : attendance.attended}</span>
            <span className="dash-stat-label">Attended</span>
          </div>
          <div className="dash-stat dash-stat--red">
            <span className="dash-stat-num">{loading ? "-" : attendance.missed}</span>
            <span className="dash-stat-label">Missed</span>
          </div>
        </section>

        <section className="dash-grid">
          <article className="dash-panel">
            <div className="dash-panel-head">
              <h2>Ready For You</h2>
              <p>Active and upcoming events you've been invited to. Scan the QR shared for your event to begin check-in.</p>
            </div>
            <div className="dash-panel-body">
              {loading ? <p className="dash-empty">Loading events...</p> : (
                <>
                  {events.active.map((event) => (
                    <EventRow key={`active-${event.id}`} event={event} actionLabel="Scan your event QR" />
                  ))}
                  {events.upcoming.map((event) => (
                    <EventRow key={`upcoming-${event.id}`} event={event} actionLabel="Upcoming" />
                  ))}
                  {events.active.length === 0 && events.upcoming.length === 0 && (
                    <p className="dash-empty">No active or upcoming invites right now.</p>
                  )}
                </>
              )}
            </div>
          </article>

          <article className="dash-panel">
            <div className="dash-panel-head">
              <h2>Recent Outcomes</h2>
              <p>See what you already attended or missed.</p>
            </div>
            <div className="dash-panel-body">
              {loading ? <p className="dash-empty">Loading event history...</p> : (
                <>
                  {events.past.slice(0, 6).map((event, index) => (
                    <EventRow
                      key={`past-${event.id}`}
                      event={event}
                      actionLabel={index < attendance.attended ? "Attended/Past" : "Past"}
                      actionTo="/attendance"
                    />
                  ))}
                  {events.past.length === 0 && (
                    <p className="dash-empty">No past invitations yet.</p>
                  )}
                </>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
