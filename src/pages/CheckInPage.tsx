import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getStoredUser, getUserDisplayName } from "../api/auth";
import { submitAttendanceCheckIn } from "../api/attendance";
import "./UserPortal.css";

async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Could not detect your location.");
  }

  const data = await response.json() as { display_name?: string };
  return data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export default function CheckInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const payload = params.get("payload") || "";
  const linkedCode = params.get("event_code") || params.get("code") || "";
  const [eventCode, setEventCode] = useState(linkedCode);
  const [locationNote, setLocationNote] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude?: number; longitude?: number }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmedCode, setConfirmedCode] = useState("");
  const [locationStatus, setLocationStatus] = useState("Requesting your location for event check-in...");
  const [locationBlocked, setLocationBlocked] = useState(false);
  const hasPayload = Boolean(payload);
  const hasCoordinates = coordinates.latitude != null && coordinates.longitude != null;
  const canSubmit = Boolean(user && hasPayload && hasCoordinates && !loading);
  const currentCheckInPath = `${location.pathname}${location.search}`;

  const nextLoginUrl = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const nextRegisterUrl = `/register?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  useEffect(() => {
    if (!hasPayload) {
      return;
    }

    sessionStorage.setItem("pendingCheckInPath", currentCheckInPath);
    localStorage.setItem("pendingCheckInPath", currentCheckInPath);
  }, [currentCheckInPath, hasPayload]);

  useEffect(() => {
    const pendingPath = sessionStorage.getItem("pendingCheckInPath") || localStorage.getItem("pendingCheckInPath");
    if (hasPayload || !pendingPath) {
      return;
    }

    if (pendingPath && pendingPath !== currentCheckInPath) {
      navigate(pendingPath, { replace: true });
    }
  }, [currentCheckInPath, hasPayload, navigate]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationBlocked(true);
      setLocationStatus("Location detection is unavailable in this browser. Check-in requires location access.");
      return;
    }

    let cancelled = false;
    setLocationBlocked(false);
    setLocationStatus("Requesting your location for event check-in...");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (cancelled) {
          return;
        }

        setCoordinates({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        try {
          const detectedLocation = await reverseGeocode(coords.latitude, coords.longitude);
          if (!cancelled) {
            setLocationNote(detectedLocation);
            setLocationStatus("Current location detected automatically.");
          }
        } catch {
          if (!cancelled) {
            setLocationNote(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
            setLocationStatus("Current location captured automatically.");
          }
        }
      },
      () => {
        if (!cancelled) {
          setCoordinates({});
          setLocationBlocked(true);
          setLocationStatus("Location access is required for check-in. Please allow it to continue.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    );

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!hasPayload || hasCoordinates) {
      return;
    }

    return requestCurrentLocation();
  }, [hasCoordinates, hasPayload]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!payload) {
      setError("Please scan the event QR again to continue check-in.");
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

    if (!hasCoordinates) {
      setError("We need your current location to submit attendance for this event.");
      return;
    }

    const { latitude, longitude } = coordinates;
    if (latitude == null || longitude == null) {
      setError("We need your current location to submit attendance for this event.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAttendanceCheckIn(
        normalizedEventCode,
        payload,
        latitude,
        longitude,
        locationNote.trim() || undefined
      );
      setConfirmedCode(normalizedEventCode);
      setSuccess(
        result.message || `Attendance recorded for event code ${normalizedEventCode}.`
      );
      sessionStorage.removeItem("pendingCheckInPath");
      localStorage.removeItem("pendingCheckInPath");
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
          <div className="user-logo">QRAMS</div>
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

          {!hasPayload && (
            <div className="user-alert user-alert--error">
              This check-in link is incomplete. Please go back and scan the event QR again to open the full check-in page.
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
                disabled={!hasPayload}
              />
            </label>

            {hasPayload && (
              <>
                <div className="user-note">
                  {locationStatus}
                  {locationNote && (
                    <span className="user-note-detail">{locationNote}</span>
                  )}
                </div>
                {locationBlocked && (
                  <button
                    type="button"
                    className="user-btn user-btn--ghost"
                    onClick={requestCurrentLocation}
                  >
                    Allow location access
                  </button>
                )}
              </>
            )}

            {!payload && (
              <div className="user-note">
                Scan the event QR from your invite or event screen. A normal app link to check-in will not contain the required scan details.
              </div>
            )}

            <div className="user-actions">
              <button className="user-btn user-btn--primary" type="submit" disabled={!canSubmit}>
                {loading ? "Submitting attendance..." : "Submit attendance"}
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
