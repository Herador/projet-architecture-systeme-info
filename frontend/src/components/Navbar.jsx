import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

const API_URL = "http://localhost:3000";

function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);

  const fetch = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token || !user) return;
    axios.get(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => setNotifications(r.data || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [fetch]);

  const markRead = async (id) => {
    const token = localStorage.getItem("token");
    await axios.patch(`${API_URL}/notifications/${id}/read`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    await axios.patch(`${API_URL}/notifications/read-all`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return { notifications, markRead, markAllRead, refresh: fetch };
}

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout, becomeOwner } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const { notifications, markRead, markAllRead } = useNotifications(user);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target))
        setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setDropdownOpen(false);
    logout();
    navigate("/login");
  }

  async function handleBecomeOwner() {
    setDropdownOpen(false);
    await becomeOwner();
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand-link">
          RentalApp
        </Link>
        <div className="navbar-nav">
          <Link to="/" className="navbar-link">Annonces</Link>
          {user?.role === "owner" && (
            <Link to="/my-properties" className="navbar-link">Mes annonces</Link>
          )}
          {user && <Link to="/bookings" className="navbar-link">Réservations</Link>}
          {user && <Link to="/messages" className="navbar-link">Messagerie</Link>}
        </div>
      </div>

<div className="navbar-right">
        {user && (
          <div className="navbar-notif" ref={notifRef}>
            <button
              className="navbar-notif-btn"
              onClick={() => { setNotifOpen((o) => !o); if (!notifOpen && unreadCount > 0) markAllRead(); }}
            >
              <BellIcon />
              {unreadCount > 0 && <span className="navbar-notif-badge">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="navbar-notif-dropdown">
                <div className="navbar-notif-header">Notifications</div>
                {notifications.length === 0 ? (
                  <div className="navbar-notif-empty">Aucune notification</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`navbar-notif-item ${!n.is_read ? "unread" : ""}`}
                      onClick={() => markRead(n.id)}
                    >
                      <span className="navbar-notif-title">{n.title}</span>
                      <span className="navbar-notif-body">{n.body}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        {user ? (
          <div className="navbar-user-menu" ref={dropdownRef}>
            <button
              type="button"
              className="navbar-user-btn"
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <UserIcon />
              <span className="navbar-username">{user.username}</span>
              <ChevronIcon open={dropdownOpen} />
            </button>

            {dropdownOpen && (
              <div className="navbar-dropdown">
                <Link
                  to="/profile"
                  className="navbar-dropdown-item"
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                  onClick={() => setDropdownOpen(false)}
                >
                  Mon profil
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    className="navbar-dropdown-item"
                    style={{ display: "block", textDecoration: "none", color: "#7c3aed" }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    Dashboard admin
                  </Link>
                )}
                {user.role === "owner" && (
                  <Link
                    to="/properties/new"
                    className="navbar-dropdown-item"
                    style={{ display: "block", textDecoration: "none", color: "inherit" }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    + Créer une annonce
                  </Link>
                )}
                {user.role === "tenant" && (
                  <Link
                    to="/become-owner"
                    className="navbar-dropdown-item"
                    style={{ display: "block", textDecoration: "none", color: "inherit" }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    Devenir propriétaire
                  </Link>
                )}
                <button className="navbar-dropdown-item navbar-dropdown-item--danger" onClick={handleLogout}>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="navbar-auth-buttons">
            <Link to="/login" className="navbar-login-btn">Se connecter</Link>
            <Link to="/register" className="navbar-register-btn">S'inscrire</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="navbar-user-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`navbar-chevron ${open ? "navbar-chevron--open" : ""}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

