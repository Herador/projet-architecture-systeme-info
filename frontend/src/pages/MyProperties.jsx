import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Properties.css";

const API_URL = "http://localhost:3000";

export default function MyProperties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "owner") {
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .get(`${API_URL}/catalog/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setProperties(res.data.filter((p) => p.owner_id === user.id)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || user.role !== "owner") {
    return (
      <p style={{ textAlign: "center", marginTop: "3rem", color: "#6b7280" }}>
        Accès réservé aux propriétaires.
      </p>
    );
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer cette annonce ?")) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${API_URL}/catalog/properties/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProperties((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Erreur lors de la suppression.");
    }
  }

  return (
    <div className="properties-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 className="properties-title" style={{ margin: 0 }}>Mes annonces</h1>
        <Link to="/properties/new" className="filter-btn" style={{ textDecoration: "none" }}>
          + Nouvelle annonce
        </Link>
      </div>

      {loading ? (
        <p className="properties-loading">Chargement...</p>
      ) : properties.length === 0 ? (
        <p className="properties-empty">Vous n'avez pas encore d'annonces.</p>
      ) : (
        <div className="properties-grid">
          {properties.map((p) => (
            <div key={p.id} className="property-card">
              <h2 className="property-card-title">{p.title}</h2>
              <p className="property-card-city">{p.city}</p>
              <p className="property-card-price">
                {p.price_per_night != null ? `${p.price_per_night} € / nuit` : "Prix non renseigné"}
              </p>
              <p className="property-card-rooms">
                {p.num_rooms != null ? `${p.num_rooms} chambre(s)` : ""}
              </p>
              <div className="property-card-actions">
                <Link to={`/properties/${p.id}/edit`} className="property-edit-btn">
                  Modifier
                </Link>
                <button className="property-delete-btn" onClick={() => handleDelete(p.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
