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
      login(data.token, data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Créer un compte</h1>

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
