import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

const API_URL = "http://localhost:3000";

const FIELDS = [
  { name: "title", label: "Titre", type: "text", required: true },
  { name: "city", label: "Ville", type: "text" },
  { name: "address", label: "Adresse", type: "text" },
  { name: "price_per_night", label: "Prix / nuit (€)", type: "number" },
  { name: "num_rooms", label: "Nombre de chambres", type: "number" },
  { name: "amenities", label: "Équipements (ex: wifi,parking)", type: "text" },
];

export default function CreateProperty() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", city: "", address: "",
    price_per_night: "", num_rooms: "", amenities: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user || user.role !== "owner") {
    return <p style={{ textAlign: "center", marginTop: "3rem", color: "#6b7280" }}>
      Accès réservé aux propriétaires.
    </p>;
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...form,
        price_per_night: form.price_per_night ? parseFloat(form.price_per_night) : null,
        num_rooms: form.num_rooms ? parseInt(form.num_rooms) : null,
      };
      await axios.post(`${API_URL}/catalog/properties`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/my-properties");
    } catch (err) {
      setError(err.response?.data?.detail || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "560px" }}>
        <h1 className="auth-title">Créer une annonce</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          {FIELDS.map(({ name, label, type, required }) => (
            <div className="auth-field" key={name}>
              <label className="auth-label">{label}</label>
              <input
                className="auth-input"
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                required={!!required}
                min={type === "number" ? "0" : undefined}
              />
            </div>
          ))}
          <div className="auth-field">
            <label className="auth-label">Description</label>
            <textarea
              className="auth-input"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              style={{ resize: "vertical" }}
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Publication..." : "Publier l'annonce"}
          </button>
        </form>
      </div>
    </div>
  );
}
