import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

const API_URL = "http://localhost:3000";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    registration_input: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, form);
      login(data.token);
      navigate("/");
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-brand">
          <div className="auth-brand-icon">
            <HomeIcon />
          </div>
        </div>

        <h1 className="auth-title">Bon retour</h1>
        <p className="auth-subtitle">Connectez-vous à votre compte</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Nom d'utilisateur ou email</label>
            <input
              className="auth-input"
              type="text"
              name="registration_input"
              value={form.registration_input}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Mot de passe</label>
            <input
              className="auth-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="auth-divider" />
        <p className="auth-footer">
          Pas encore de compte ?{" "}
          <Link to="/register" className="auth-link">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}

function translateError(err) {
  const detail = err.response?.data?.detail;
  const status = err.response?.status;
  if (status === 500) return "Une erreur serveur est survenue. Veuillez réessayer.";
  if (status === 422) return "Données invalides. Vérifiez les champs saisis.";
  if (detail === "Invalid username or email") return "Nom d'utilisateur ou email invalide.";
  if (detail === "Invalid password")          return "Mot de passe incorrect.";
  if (detail === "User is already connected") return "Vous êtes déjà connecté.";
  if (detail === "Token expired")             return "Session expirée, veuillez vous reconnecter.";
  if (detail === "User not found")            return "Utilisateur introuvable.";
  return "Une erreur est survenue.";
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
