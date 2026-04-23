import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout, getStoredUser, getUserDisplayName, listUsers } from "../api/auth";
import type { UserProfile } from "../api/auth";
import "./AdminLayout.css";

export default function AdminUsers() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = getUserDisplayName(user);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const load = useCallback(() => {
    listUsers(search, roleFilter)
      .then((d) => {
        setUsers(d.results || []);
        setCount(d.count || 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="adm-wrapper">
      <header className="adm-header">
        <div className="adm-header-left">
          <div className="adm-logo">QRAMS</div>
          <span className="adm-badge">Admin</span>
          <nav className="adm-subnav" style={{ border: "none", padding: "0", background: "transparent", marginLeft: "1rem" }}>
            <Link to="/admin/dashboard" className="adm-subnav-link">Dashboard</Link>
            <Link to="/admin/events" className="adm-subnav-link">Events</Link>
            <span className="adm-subnav-link adm-subnav-link--active">Users</span>
          </nav>
        </div>
        <div className="adm-header-right">
          {user && <span className="adm-greeting">{displayName}</span>}
          <button className="adm-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-hero">
          <h1 className="adm-title">Users</h1>
          <p className="adm-sub">{count} registered user{count !== 1 ? "s" : ""}</p>
        </div>

        <div className="adm-controls">
          <div style={{ display: "flex", gap: "6px" }}>
            {["", "user", "admin"].map((r) => (
              <button
                key={r || "all"}
                className={`adm-btn adm-btn--sm ${roleFilter === r ? "adm-btn--primary" : "adm-btn--ghost"}`}
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRoleFilter(r);
                }}
              >
                {r ? r.charAt(0).toUpperCase() + r.slice(1) : "All"}
              </button>
            ))}
          </div>
          <div className="adm-search-wrap">
            <svg className="adm-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input className="adm-search" placeholder="Search users..." value={search}
              onChange={(e) => {
                setLoading(true);
                setError("");
                setSearch(e.target.value);
              }} />
          </div>
        </div>

        {error && <div className="adm-error">{error}</div>}

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="adm-th">No</th>
                <th className="adm-th">Name</th>
                <th className="adm-th">Username</th>
                <th className="adm-th">Email</th>
                <th className="adm-th">Phone</th>
                <th className="adm-th">Role</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="adm-tr">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="adm-td"><div className="adm-skel adm-skel--wide" /></td>
                  ))}
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="adm-empty">No users found.</td></tr>
              )}
              {!loading && users.map((u, index) => (
                <tr key={u.id} className="adm-tr">
                  <td className="adm-td adm-td--muted">{index + 1}</td>
                  <td className="adm-td adm-td--bold">{u.first_name} {u.last_name}</td>
                  <td className="adm-td adm-td--muted">{u.username}</td>
                  <td className="adm-td adm-td--muted">{u.email}</td>
                  <td className="adm-td adm-td--muted">{u.phone || "—"}</td>
                  <td className="adm-td">
                    <span className={`adm-status ${u.role === "admin" ? "adm-status--upcoming" : "adm-status--past"}`}>
                      {u.role}
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
