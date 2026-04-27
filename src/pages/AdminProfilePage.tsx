import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getStoredUser,
  getUserDisplayName,
  logout,
  refreshStoredUserProfile,
  updateMyProfile,
} from "../api/auth";
import "./AdminLayout.css";

export default function AdminProfilePage() {
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

  const roleLabel = user?.is_superuser ? "Superuser" : user?.role === "admin" ? "Admin" : "User";

  return (
    <div className="adm-wrapper">
      <header className="adm-header">
        <div className="adm-header-left">
          <div className="adm-logo">QRAMS</div>
          <span className="adm-badge">{roleLabel}</span>
          <nav className="adm-subnav" style={{ border: "none", padding: "0", background: "transparent", marginLeft: "1rem" }}>
            <Link to="/admin/dashboard" className="adm-subnav-link">Dashboard</Link>
            <Link to="/admin/events" className="adm-subnav-link">Events</Link>
            <Link to="/admin/users" className="adm-subnav-link">Users</Link>
            <span className="adm-subnav-link adm-subnav-link--active">Profile</span>
          </nav>
        </div>
        <div className="adm-header-right">
          {user && <span className="adm-greeting">{displayName}</span>}
          <button className="adm-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-hero">
          <h1 className="adm-title">Admin Profile</h1>
          <p className="adm-sub">Manage your account details, contact info, and sign-in identity.</p>
        </div>

        <section className="adm-profile-shell">
          <div className="adm-profile-hero">
            <div className="adm-profile-orb" aria-hidden="true">
              {displayName ? displayName.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="adm-profile-copy">
              <p className="adm-profile-kicker">Account center</p>
              <h2>{displayName || "Admin account"}</h2>
              <p>{roleLabel} access is tied to this profile and email address.</p>
            </div>
          </div>

          <form className="adm-profile-form" onSubmit={handleSubmit}>
            {error && <div className="adm-error">{error}</div>}
            {success && <div className="adm-success">{success}</div>}
            {loadingProfile && <div className="adm-profile-note">Loading your latest admin profile details...</div>}

            {!loadingProfile && !form.phone && (
              <div className="adm-profile-note">
                No phone number is currently saved on this account. Use <strong>Edit profile</strong> to add one.
              </div>
            )}

            <div className="adm-profile-form-shell">
              <div className="adm-field-row">
                <label className="adm-field">
                  <span className="adm-label">First name</span>
                  <input className="adm-input" name="first_name" value={form.first_name} onChange={handleChange} disabled={!isEditing || saving} />
                </label>
                <label className="adm-field">
                  <span className="adm-label">Last name</span>
                  <input className="adm-input" name="last_name" value={form.last_name} onChange={handleChange} disabled={!isEditing || saving} />
                </label>
              </div>

              <label className="adm-field">
                <span className="adm-label">Username</span>
                <input className="adm-input" name="username" value={form.username} onChange={handleChange} disabled={!isEditing || saving} />
              </label>

              <label className="adm-field">
                <span className="adm-label">Email</span>
                <input className="adm-input" name="email" type="email" value={form.email} onChange={handleChange} disabled={!isEditing || saving} />
              </label>

              <div className="adm-field-row">
                <label className="adm-field">
                  <span className="adm-label">Phone</span>
                  <input
                    className="adm-input"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    disabled={!isEditing || saving}
                    placeholder={isEditing ? "Add your phone number" : ""}
                  />
                </label>
                <label className="adm-field">
                  <span className="adm-label">Role</span>
                  <input className="adm-input" value={roleLabel} disabled />
                </label>
              </div>
            </div>

            <div className="adm-profile-actions">
              {isEditing ? (
                <>
                  <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button className="adm-btn adm-btn--ghost" type="button" onClick={() => void handleCancelEdit()} disabled={saving}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="adm-btn adm-btn--primary" type="button" onClick={handleStartEdit} disabled={loadingProfile}>
                  Edit profile
                </button>
              )}
              <button className="adm-btn adm-btn--ghost" type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
