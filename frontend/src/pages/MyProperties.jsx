import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Properties.css";

const API_URL = "http://localhost:3000";

const STATUS_LABELS = {
  published: "Publiée",
  draft:     "Brouillon",
  archived:  "Archivée",
};

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
    return <p className="properties-state">Accès réservé aux propriétaires.</p>;
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

      <div className="properties-header">
        <div>
          <h1 className="properties-title">Mes annonces</h1>
          {!loading && (
            <p className="properties-count">
              {properties.length} annonce{properties.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link to="/properties/new" className="properties-new-btn">
          <PlusIcon /> Nouvelle annonce
        </Link>
      </div>

      {loading ? (
        <p className="properties-state">Chargement...</p>
      ) : properties.length === 0 ? (
        <p className="properties-state">Vous n'avez pas encore d'annonces.</p>
      ) : (
        <div className="properties-grid">
          {properties.map((p) => (
            <div key={p.id} className="property-card">

              <div className="property-card-image">
                <span className="property-card-image-icon">🏠</span>
                {p.status && (
                  <span className={`property-card-status property-card-status--${p.status}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                )}
                {p.price_per_night != null && (
                  <span className="property-card-price-badge">
                    {parseFloat(p.price_per_night).toFixed(0)} € <span>/nuit</span>
                  </span>
                )}
              </div>

              <div className="property-card-body">
                <p className="property-card-title">{p.title}</p>
                <div className="property-card-meta">
                  {p.city && <span className="property-card-city">{p.city}</span>}
                  {p.num_rooms != null && (
                    <span className="property-card-rooms">{p.num_rooms} ch.</span>
                  )}
                </div>
              </div>

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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
