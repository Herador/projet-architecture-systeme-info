import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/AdminDashboard.css";

const API_URL = "http://localhost:3000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

// ── NAV SECTIONS ──────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: "stats",      label: "Vue d'ensemble", icon: <ChartIcon /> },
  { key: "users",      label: "Utilisateurs",   icon: <UsersIcon /> },
  { key: "properties", label: "Annonces",        icon: <HomeIcon /> },
  { key: "bookings",   label: "Réservations",    icon: <CalendarIcon /> },
];

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("stats");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "admin") { navigate("/"); }
  }, [user, navigate]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <ShieldIcon />
          <span>Administration</span>
        </div>
        <nav className="admin-sidebar-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`admin-nav-item ${section === s.key ? "admin-nav-item--active" : ""}`}
              onClick={() => setSection(s.key)}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h1 className="admin-page-title">
            {SECTIONS.find((s) => s.key === section)?.label}
          </h1>
          <span className="admin-topbar-user">{user.username}</span>
        </header>

        <div className="admin-content">
          {section === "stats"      && <StatsSection />}
          {section === "users"      && <UsersSection />}
          {section === "properties" && <PropertiesSection />}
          {section === "bookings"   && <BookingsSection />}
        </div>
      </main>
    </div>
  );
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function StatsSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/admin/stats`, { headers: authHeaders() })
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (!stats)  return <p className="admin-empty">Impossible de charger les statistiques.</p>;

  return (
    <div className="admin-stats">
      {/* Primary KPIs */}
      <div className="admin-kpi-grid">
        <KpiCard label="Utilisateurs"   value={stats.users.total}      color="blue"   icon={<UsersIcon />} />
        <KpiCard label="Annonces"        value={stats.properties.total} color="purple" icon={<HomeIcon />} />
        <KpiCard label="Réservations"   value={stats.bookings.total}   color="orange" icon={<CalendarIcon />} />
        <KpiCard label="Revenus payés"  value={`${stats.revenue.toFixed(2)} €`} color="green" icon={<EuroIcon />} />
      </div>

      {/* Breakdown rows */}
      <div className="admin-breakdown-grid">
        <BreakdownCard title="Utilisateurs par rôle" items={[
          { label: "Locataires",       value: stats.users.by_role.tenant, color: "#16a34a" },
          { label: "Propriétaires",    value: stats.users.by_role.owner,  color: "#2563eb" },
          { label: "Administrateurs",  value: stats.users.by_role.admin,  color: "#7c3aed" },
        ]} />

        <BreakdownCard title="Annonces par statut" items={[
          { label: "Publiées",   value: stats.properties.by_status.published, color: "#16a34a" },
          { label: "Brouillons", value: stats.properties.by_status.draft,     color: "#f59e0b" },
          { label: "Archivées",  value: stats.properties.by_status.archived,  color: "#9ca3af" },
        ]} />

        <BreakdownCard title="Réservations par statut" items={[
          { label: "En attente", value: stats.bookings.by_status.pending,   color: "#f59e0b" },
          { label: "Acceptées",  value: stats.bookings.by_status.accepted,  color: "#2563eb" },
          { label: "Payées",     value: stats.bookings.by_status.paid,      color: "#16a34a" },
          { label: "Refusées",   value: stats.bookings.by_status.refused,   color: "#e53e3e" },
          { label: "Annulées",   value: stats.bookings.by_status.cancelled, color: "#9ca3af" },
        ]} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, icon }) {
  return (
    <div className={`admin-kpi-card admin-kpi-card--${color}`}>
      <div className="admin-kpi-icon">{icon}</div>
      <div className="admin-kpi-body">
        <span className="admin-kpi-value">{value}</span>
        <span className="admin-kpi-label">{label}</span>
      </div>
    </div>
  );
}

function BreakdownCard({ title, items }) {
  const total = items.reduce((s, i) => s + (i.value || 0), 0);
  return (
    <div className="admin-breakdown-card">
      <h3 className="admin-breakdown-title">{title}</h3>
      <ul className="admin-breakdown-list">
        {items.map((item) => (
          <li key={item.label} className="admin-breakdown-item">
            <span className="admin-breakdown-dot" style={{ background: item.color }} />
            <span className="admin-breakdown-label">{item.label}</span>
            <span className="admin-breakdown-value">{item.value ?? 0}</span>
            {total > 0 && (
              <span className="admin-breakdown-pct">
                {Math.round(((item.value ?? 0) / total) * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── USERS ─────────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = ["", "tenant", "owner", "admin"];
const ROLE_LABELS  = { tenant: "Locataire", owner: "Propriétaire", admin: "Admin" };
const ROLE_COLORS  = { tenant: "green", owner: "blue", admin: "purple" };

function UsersSection() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterRole, setFilter] = useState("");
  const [confirm, setConfirm]   = useState(null); // { type: "delete"|"role", userId, extra }
  const [actionLoading, setAL]  = useState(false);
  const [toast, setToast]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterRole) params.role   = filterRole;
    if (search)     params.search = search;
    axios.get(`${API_URL}/admin/users`, { headers: authHeaders(), params })
      .then((r) => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterRole, search]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDeleteUser() {
    setAL(true);
    try {
      await axios.delete(`${API_URL}/admin/users/${confirm.userId}`, { headers: authHeaders() });
      showToast("Utilisateur supprimé");
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Erreur lors de la suppression", "error");
    } finally {
      setAL(false);
      setConfirm(null);
    }
  }

  async function handleChangeRole() {
    setAL(true);
    try {
      await axios.patch(
        `${API_URL}/admin/users/${confirm.userId}/role`,
        { role: confirm.newRole },
        { headers: authHeaders() }
      );
      showToast(`Rôle changé en ${ROLE_LABELS[confirm.newRole]}`);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Erreur lors du changement de rôle", "error");
    } finally {
      setAL(false);
      setConfirm(null);
    }
  }

  return (
    <div className="admin-section">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="text"
          placeholder="Rechercher par nom ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-select"
          value={filterRole}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tous les rôles</option>
          {ROLE_OPTIONS.filter(Boolean).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button className="admin-btn-refresh" onClick={load}>↺</button>
      </div>

      {loading ? <Loader /> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom d'utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Vérifié</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} className="admin-table-empty">Aucun utilisateur trouvé</td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td className="admin-td-bold">{u.username}</td>
                  <td className="admin-td-muted">{u.email}</td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td>
                    <span className={`admin-verified ${u.is_verified ? "admin-verified--yes" : "admin-verified--no"}`}>
                      {u.is_verified ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="admin-td-actions">
                    <select
                      className="admin-select admin-select--sm"
                      defaultValue={u.role}
                      onChange={(e) => {
                        if (e.target.value !== u.role)
                          setConfirm({ type: "role", userId: u.id, username: u.username, newRole: e.target.value, currentRole: u.role });
                        else
                          e.target.value = u.role;
                      }}
                    >
                      {ROLE_OPTIONS.filter(Boolean).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <button
                      className="admin-btn-danger-sm"
                      onClick={() => setConfirm({ type: "delete", userId: u.id, username: u.username })}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm?.type === "delete" && (
        <ConfirmModal
          title="Supprimer l'utilisateur"
          message={`Supprimer définitivement « ${confirm.username} » ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          danger
          loading={actionLoading}
          onConfirm={handleDeleteUser}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.type === "role" && (
        <ConfirmModal
          title="Changer le rôle"
          message={`Changer le rôle de « ${confirm.username} » de ${ROLE_LABELS[confirm.currentRole]} → ${ROLE_LABELS[confirm.newRole]} ?`}
          confirmLabel="Confirmer"
          loading={actionLoading}
          onConfirm={handleChangeRole}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── PROPERTIES ────────────────────────────────────────────────────────────────
const PROP_STATUS_LABELS  = { draft: "Brouillon", published: "Publiée", archived: "Archivée" };
const PROP_STATUS_COLORS  = { draft: "orange", published: "green", archived: "gray" };
const PROP_STATUS_OPTIONS = ["", "draft", "published", "archived"];

function PropertiesSection() {
  const [props, setProps]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterSt, setFilter]   = useState("");
  const [confirm, setConfirm]   = useState(null);
  const [actionLoading, setAL]  = useState(false);
  const [toast, setToast]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterSt) params.status = filterSt;
    if (search)   params.search = search;
    axios.get(`${API_URL}/admin/properties`, { headers: authHeaders(), params })
      .then((r) => setProps(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterSt, search]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete() {
    setAL(true);
    try {
      await axios.delete(`${API_URL}/admin/properties/${confirm.id}`, { headers: authHeaders() });
      showToast("Annonce supprimée");
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Erreur", "error");
    } finally {
      setAL(false);
      setConfirm(null);
    }
  }

  async function handleStatusChange() {
    setAL(true);
    try {
      await axios.patch(
        `${API_URL}/admin/properties/${confirm.id}/status`,
        { status: confirm.newStatus },
        { headers: authHeaders() }
      );
      showToast(`Statut changé en ${PROP_STATUS_LABELS[confirm.newStatus]}`);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Erreur", "error");
    } finally {
      setAL(false);
      setConfirm(null);
    }
  }

  return (
    <div className="admin-section">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="text"
          placeholder="Rechercher par titre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-select"
          value={filterSt}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {PROP_STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{PROP_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button className="admin-btn-refresh" onClick={load}>↺</button>
      </div>

      {loading ? <Loader /> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Ville</th>
                <th>Prix/nuit</th>
                <th>Propriétaire</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.length === 0 ? (
                <tr><td colSpan={6} className="admin-table-empty">Aucune annonce trouvée</td></tr>
              ) : props.map((p) => (
                <tr key={p.id}>
                  <td className="admin-td-bold">{p.title}</td>
                  <td className="admin-td-muted">{p.city || "—"}</td>
                  <td>{p.price_per_night != null ? `${p.price_per_night} €` : "—"}</td>
                  <td className="admin-td-muted">{p.owner.username}</td>
                  <td><StatusBadge label={PROP_STATUS_LABELS[p.status]} color={PROP_STATUS_COLORS[p.status]} /></td>
                  <td className="admin-td-actions">
                    <select
                      className="admin-select admin-select--sm"
                      defaultValue={p.status}
                      onChange={(e) => {
                        if (e.target.value !== p.status)
                          setConfirm({ type: "status", id: p.id, title: p.title, newStatus: e.target.value, currentStatus: p.status });
                        else
                          e.target.value = p.status;
                      }}
                    >
                      {PROP_STATUS_OPTIONS.filter(Boolean).map((s) => (
                        <option key={s} value={s}>{PROP_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <button
                      className="admin-btn-danger-sm"
                      onClick={() => setConfirm({ type: "delete", id: p.id, title: p.title })}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm?.type === "delete" && (
        <ConfirmModal
          title="Supprimer l'annonce"
          message={`Supprimer définitivement « ${confirm.title} » ?`}
          confirmLabel="Supprimer"
          danger
          loading={actionLoading}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.type === "status" && (
        <ConfirmModal
          title="Changer le statut"
          message={`Changer le statut de « ${confirm.title} » vers ${PROP_STATUS_LABELS[confirm.newStatus]} ?`}
          confirmLabel="Confirmer"
          loading={actionLoading}
          onConfirm={handleStatusChange}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
const BOOKING_STATUS_LABELS = {
  pending: "En attente", accepted: "Acceptée", refused: "Refusée",
  paid: "Payée", cancelled: "Annulée",
};
const BOOKING_STATUS_COLORS = {
  pending: "orange", accepted: "blue", refused: "red",
  paid: "green", cancelled: "gray",
};
const BOOKING_STATUS_OPTIONS = ["", "pending", "accepted", "refused", "paid", "cancelled"];

function BookingsSection() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterSt, setFilter]   = useState("");
  const [confirm, setConfirm]   = useState(null);
  const [actionLoading, setAL]  = useState(false);
  const [toast, setToast]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterSt) params.status = filterSt;
    if (search)   params.search = search;
    axios.get(`${API_URL}/admin/bookings`, { headers: authHeaders(), params })
      .then((r) => setBookings(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterSt, search]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCancel() {
    setAL(true);
    try {
      await axios.delete(`${API_URL}/admin/bookings/${confirm.id}`, { headers: authHeaders() });
      showToast("Réservation annulée");
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Erreur", "error");
    } finally {
      setAL(false);
      setConfirm(null);
    }
  }

  return (
    <div className="admin-section">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="text"
          placeholder="Rechercher par annonce ou locataire…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-select"
          value={filterSt}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {BOOKING_STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button className="admin-btn-refresh" onClick={load}>↺</button>
      </div>

      {loading ? <Loader /> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Annonce</th>
                <th>Locataire</th>
                <th>Propriétaire</th>
                <th>Dates</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan={7} className="admin-table-empty">Aucune réservation trouvée</td></tr>
              ) : bookings.map((b) => (
                <tr key={b.id}>
                  <td className="admin-td-bold">{b.property.title}</td>
                  <td className="admin-td-muted">{b.tenant.username}</td>
                  <td className="admin-td-muted">{b.owner.username}</td>
                  <td className="admin-td-dates">
                    {b.check_in} <span>→</span> {b.check_out}
                  </td>
                  <td>{b.total_price != null ? `${b.total_price} €` : "—"}</td>
                  <td>
                    <StatusBadge
                      label={BOOKING_STATUS_LABELS[b.status]}
                      color={BOOKING_STATUS_COLORS[b.status]}
                    />
                  </td>
                  <td className="admin-td-actions">
                    {!["cancelled", "refused"].includes(b.status) && (
                      <button
                        className="admin-btn-danger-sm"
                        onClick={() => setConfirm({ id: b.id, property: b.property.title, tenant: b.tenant.username })}
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title="Annuler la réservation"
          message={`Annuler la réservation de « ${confirm.tenant} » pour « ${confirm.property} » ?`}
          confirmLabel="Annuler la réservation"
          danger
          loading={actionLoading}
          onConfirm={handleCancel}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── SHARED UI ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  return (
    <span className={`admin-badge admin-badge--${ROLE_COLORS[role] || "gray"}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusBadge({ label, color }) {
  return <span className={`admin-badge admin-badge--${color || "gray"}`}>{label}</span>;
}

function Loader() {
  return (
    <div className="admin-loader">
      <div className="admin-spinner" />
    </div>
  );
}

function Toast({ msg, type }) {
  return (
    <div className={`admin-toast admin-toast--${type}`}>{msg}</div>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, loading, onConfirm, onCancel }) {
  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-modal-title">{title}</h3>
        <p className="admin-modal-message">{message}</p>
        <div className="admin-modal-actions">
          <button className="admin-modal-cancel" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button
            className={danger ? "admin-modal-confirm-danger" : "admin-modal-confirm"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ICONS ─────────────────────────────────────────────────────────────────────
function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

function EuroIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h12M4 14h12M19.5 9A7.5 7.5 0 1 0 19.5 15" />
    </svg>
  );
}
