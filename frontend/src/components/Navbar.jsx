import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout, becomeOwner } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleBecomeOwner() {
    setDropdownOpen(false);
    await becomeOwner();
  }

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
        </div>
      </div>

<div className="navbar-right">
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
                  <button className="navbar-dropdown-item" onClick={handleBecomeOwner}>
                    Devenir propriétaire
                  </button>
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

