import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/UserInfo.css";

export default function UserInfo() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="userinfo-page">
        <p className="userinfo-empty">Vous devez être connecté pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="userinfo-page">
      <div className="userinfo-card">
        <div className="userinfo-avatar">
          <AvatarIcon />
        </div>

        <h1 className="userinfo-username">{user.username}</h1>

        <span className={`userinfo-role-badge ${user.role === "owner" ? "userinfo-role-badge--owner" : "userinfo-role-badge--tenant"}`}>
          {user.role === "owner" ? "Propriétaire" : "Locataire"}
        </span>

        <div className="userinfo-fields">
          <div className="userinfo-field">
            <span className="userinfo-field-label">Nom d'utilisateur</span>
            <span className="userinfo-field-value">{user.username}</span>
          </div>

          {user.email && (
            <div className="userinfo-field">
              <span className="userinfo-field-label">Adresse e-mail</span>
              <span className="userinfo-field-value">{user.email}</span>
            </div>
          )}

          {user.phone && (
            <div className="userinfo-field">
              <span className="userinfo-field-label">Téléphone</span>
              <span className="userinfo-field-value">{user.phone}</span>
            </div>
          )}

          <div className="userinfo-field">
            <span className="userinfo-field-label">Rôle</span>
            <span className="userinfo-field-value">
              {user.role === "owner" ? "Propriétaire" : "Locataire"}
            </span>
          </div>
        </div>

        {user.role === "tenant" && (
          <div className="userinfo-become-owner">
            <p className="userinfo-become-owner-text">
              Vous souhaitez mettre des logements en location ?
            </p>
            <Link to="/become-owner" className="userinfo-become-owner-btn">
              Devenir propriétaire
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

function AvatarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="userinfo-avatar-icon">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  );
}
