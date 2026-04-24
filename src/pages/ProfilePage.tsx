import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser, getUserDisplayName, logout, refreshStoredUserProfile, updateMyProfile } from "../api/auth";
import "./UserPortal.css";

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const [loadingProfile, setLoadingProfile] = useState(Boolean(user?.id));
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [originalEmail, setOriginalEmail] = useState(user?.email || "");

  useEffect(() => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }

    refreshStoredUserProfile()
      .then((freshUser) => {
        setOriginalEmail(freshUser.email || "");
        setForm({
          first_name: freshUser.first_name || "",
          last_name: freshUser.last_name || "",
          username: freshUser.username || "",
          email: freshUser.email || "",
          phone: freshUser.phone || "",
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      })
      .finally(() => setLoadingProfile(false));
  }, [user?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setError("");
    setSuccess("");
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetProfileForm = async () => {
    const freshUser = await refreshStoredUserProfile();
    setOriginalEmail(freshUser.email || "");
    setForm({
      first_name: freshUser.first_name || "",
      last_name: freshUser.last_name || "",
      username: freshUser.username || "",
      email: freshUser.email || "",
      phone: freshUser.phone || "",
    });
  };

  const handleStartEdit = () => {
    setError("");
    setSuccess("");
    setIsEditing(true);
  };

  const handleCancelEdit = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await resetProfileForm();
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reload profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isEditing) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const submittedEmail = form.email;
      const response = await updateMyProfile(form);
      const emailChanged =
        submittedEmail.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
      const requiresEmailVerification =
        response.data?.email_verification_required === true || emailChanged;

      await resetProfileForm();
      setIsEditing(false);

      if (requiresEmailVerification) {
        setSuccess(response.message || "Your email was changed. Please verify your new email address.");

        window.setTimeout(async () => {
          await logout();
          navigate(`/verify-email?email=${encodeURIComponent(submittedEmail)}`, { replace: true });
        }, 1200);

        return;
      }

      setSuccess(response.message || "Profile updated successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="user-wrapper">
      <header className="user-header">
        <div className="user-brand">
          <div className="user-logo">QRAMS</div>
          <div>
            <p className="user-eyebrow">Profile</p>
            <h1 className="user-header-title">{displayName}</h1>
          </div>
        </div>
        <nav className="user-nav">
          <Link to="/dashboard" className="user-nav-link">Dashboard</Link>
          <Link to="/attendance" className="user-nav-link">Attendance</Link>
          <span className="user-nav-link user-nav-link--active">Profile</span>
        </nav>
      </header>

      <main className="user-main">
        <section className="user-panel user-panel--narrow">
          <div className="profile-hero">
            <div className="profile-orb" aria-hidden="true">
              {displayName ? displayName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="profile-hero-copy">
              <p className="profile-kicker">Account center</p>
              <div className="user-panel-head" style={{ marginBottom: 0 }}>
                <h2>My Profile</h2>
                
              </div>
            </div>
          </div>

          <form className="user-form" onSubmit={handleSubmit}>
            {error && <div className="user-alert user-alert--error">{error}</div>}
            {success && <div className="user-alert user-alert--success">{success}</div>}
            {loadingProfile && <div className="user-note">Loading your latest profile details...</div>}

            {!loadingProfile && !form.phone && (
              <div className="user-note">
                No phone number is currently saved on your account. Tap <strong>Edit profile</strong> to add one.
              </div>
            )}

            <div className="profile-form-shell">
              <div className="user-form-grid">
                <label className="user-field">
                  <span>First name</span>
                  <input name="first_name" value={form.first_name} onChange={handleChange} disabled={!isEditing || saving} />
                </label>
                <label className="user-field">
                  <span>Last name</span>
                  <input name="last_name" value={form.last_name} onChange={handleChange} disabled={!isEditing || saving} />
                </label>
              </div>

              <label className="user-field">
                <span>Username</span>
                <input name="username" value={form.username} onChange={handleChange} disabled={!isEditing || saving} />
              </label>

              <label className="user-field">
                <span>Email</span>
                <input name="email" type="email" value={form.email} onChange={handleChange} disabled={!isEditing || saving} />
              </label>

              <label className="user-field">
                <span>Phone</span>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                  placeholder={isEditing ? "Add your phone number" : ""}
                />
              </label>
            </div>

            <div className="user-actions">
              {isEditing ? (
                <>
                  <button className="user-btn user-btn--primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button className="user-btn user-btn--ghost" type="button" onClick={() => void handleCancelEdit()} disabled={saving}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="user-btn user-btn--primary" type="button" onClick={handleStartEdit} disabled={loadingProfile}>
                  Edit profile
                </button>
              )}
              <button className="user-btn user-btn--ghost" type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
