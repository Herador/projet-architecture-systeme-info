import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Register.css";

const API_URL = "http://localhost:3000";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm_password) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, form);
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

        <h1 className="auth-title">Créer un compte</h1>
        <p className="auth-subtitle">Rejoignez notre communauté</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <Field
            label="Nom d'utilisateur"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <Field
            label="Mot de passe"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <Field
            label="Confirmer le mot de passe"
            name="confirm_password"
            type="password"
            value={form.confirm_password}
            onChange={handleChange}
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Inscription..." : "S'inscrire"}
          </button>
        </form>

        <div className="auth-divider" />
        <p className="auth-footer">
          Déjà un compte ?{" "}
          <Link to="/login" className="auth-link">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

function translateError(err) {
  const detail = err.response?.data?.detail;
  const status = err.response?.status;
  if (status === 500) return "Ce nom d'utilisateur ou cet email est déjà utilisé.";
  if (status === 422) return "Données invalides. Vérifiez les champs saisis.";
  if (detail === "Invalid username or email") return "Nom d'utilisateur ou email invalide.";
  if (detail === "Invalid password")          return "Mot de passe incorrect.";
  if (detail === "User is already connected") return "Vous êtes déjà connecté.";
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

function Field({ label, name, type, value, onChange, required }) {
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <input
        className="auth-input"
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete="off"
      />
    </div>
  );
}
