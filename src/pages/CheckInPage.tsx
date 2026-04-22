import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getStoredUser, getUserDisplayName } from "../api/auth";
import { submitScan } from "../api/dotnet";
import "./UserPortal.css";

export default function CheckInPage() {
  const location = useLocation();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const payload = params.get("payload") || "";
  const linkedCode = params.get("event_code") || params.get("code") || "";
  const [eventCode, setEventCode] = useState(linkedCode);
  const [locationNote, setLocationNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmedCode, setConfirmedCode] = useState("");

  const nextLoginUrl = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const nextRegisterUrl = `/register?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!payload) {
      setError("This QR link is missing the scan payload.");
      return;
    }

    if (!user?.username) {
      setError("Sign in first before completing check-in.");
      return;
    }

    const normalizedEventCode = eventCode.trim().toUpperCase();
    const normalizedLinkedCode = linkedCode.trim().toUpperCase();

    if (!normalizedEventCode) {
      setError("Enter the event code to continue.");
      return;
    }

    if (normalizedLinkedCode && normalizedEventCode !== normalizedLinkedCode) {
      setError("The event code does not match this QR link.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitScan(
        payload,
        user.username,
        normalizedEventCode,
        locationNote.trim() || undefined
      );
      setConfirmedCode(normalizedEventCode);
      setSuccess(
        result.message || `You have been marked attended for event code ${normalizedEventCode}.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-wrapper">
      <header className="user-header">
        <div className="user-brand">
          <div className="user-logo">QR</div>
          <div>
            <p className="user-eyebrow">Check In</p>
            <h1 className="user-header-title">{user ? `Hello ${displayName}` : "Event access"}</h1>
          </div>
        </div>
        <nav className="user-nav">
          {user ? (
            <>
              <Link to="/dashboard" className="user-nav-link">Dashboard</Link>
              <Link to="/attendance" className="user-nav-link">Attendance</Link>
              <Link to="/profile" className="user-nav-link">Profile</Link>
            </>
          ) : (
            <>
              <Link to={nextLoginUrl} className="user-nav-link">Sign in</Link>
              <Link to={nextRegisterUrl} className="user-nav-link">Register</Link>
            </>
          )}
        </nav>
      </header>

      <main className="user-main">
        <section className="user-panel user-panel--narrow">
          <div className="user-panel-head">
            <h2>Event Check-In</h2>
            <p>
              Registered users can confirm attendance here after scanning a valid QR code and entering the event code.
            </p>
          </div>

          {!user && (
            <div className="user-alert user-alert--error">
              Sign in to your registered account first, then come back here to finish check-in.
            </div>
          )}

          {linkedCode && (
            <div className="user-note">
              This QR is linked to event code <strong>{linkedCode}</strong>. Enter that code below to be marked present.
            </div>
          )}

          <form className="user-form" onSubmit={handleSubmit}>
            {error && <div className="user-alert user-alert--error">{error}</div>}
            {success && <div className="user-alert user-alert--success">{success}</div>}
            {success && (
              <div className="user-note">
                Attendance confirmed{confirmedCode ? ` for event code ${confirmedCode}` : ""}. You can open your attendance page to review it.
              </div>
            )}

            <label className="user-field">
              <span>Event code</span>
              <input
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="Enter the event code"
                autoCapitalize="characters"
              />
            </label>

            <label className="user-field">
              <span>Location note</span>
              <input
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                placeholder="Optional room, building, or location note"
              />
            </label>

            {!payload && (
              <div className="user-note">
                This QR link is incomplete. The backend should send users here with a valid <code>payload</code> query value.
              </div>
            )}

            <div className="user-actions">
              <button className="user-btn user-btn--primary" type="submit" disabled={loading || !user}>
                {loading ? "Checking in..." : "Mark attendance"}
              </button>
              {user ? (
                <Link to="/attendance" className="user-btn user-btn--ghost user-btn--link">View attendance</Link>
              ) : (
                <Link to={nextLoginUrl} className="user-btn user-btn--ghost user-btn--link">Sign in to continue</Link>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
