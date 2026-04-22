import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser, getUserDisplayName, logout, updateMyProfile } from "../api/auth";
import "./UserPortal.css";

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setError("");
    setSuccess("");
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateMyProfile(form);
      setSuccess("Profile updated successfully.");
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
          <div className="user-logo">QR</div>
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
          <div className="user-panel-head">
            <h2>My Profile</h2>
            <p>Update your account details here. Logout lives here too.</p>
          </div>

          <form className="user-form" onSubmit={handleSubmit}>
            {error && <div className="user-alert user-alert--error">{error}</div>}
            {success && <div className="user-alert user-alert--success">{success}</div>}

            <div className="user-form-grid">
              <label className="user-field">
                <span>First name</span>
                <input name="first_name" value={form.first_name} onChange={handleChange} />
              </label>
              <label className="user-field">
                <span>Last name</span>
                <input name="last_name" value={form.last_name} onChange={handleChange} />
              </label>
            </div>

            <label className="user-field">
              <span>Username</span>
              <input name="username" value={form.username} onChange={handleChange} />
            </label>

            <label className="user-field">
              <span>Email</span>
              <input name="email" type="email" value={form.email} onChange={handleChange} />
            </label>

            <label className="user-field">
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </label>

            <div className="user-actions">
              <button className="user-btn user-btn--primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save profile"}
              </button>
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
