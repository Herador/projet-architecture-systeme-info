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
        <h1 className="auth-title">Connexion</h1>

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
