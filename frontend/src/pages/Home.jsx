import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "../styles/Properties.css";

const API_URL = "http://localhost:3000";

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({ city: "", max_price: "", min_rooms: "" });
  const [loading, setLoading] = useState(true);

  async function fetchProperties() {
    setLoading(true);
    try {
      const params = {};
      if (filters.city) params.city = filters.city;
      if (filters.max_price) params.max_price = filters.max_price;
      if (filters.min_rooms) params.min_rooms = filters.min_rooms;
      const { data } = await axios.get(`${API_URL}/catalog/properties`, { params });
      setProperties(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProperties();
  }, []);

  function handleFilter(e) {
    e.preventDefault();
    fetchProperties();
  }

  return (
    <div className="properties-page">
      <h1 className="properties-title">Logements disponibles</h1>

      <form className="properties-filters" onSubmit={handleFilter}>
        <input
          className="filter-input"
          placeholder="Ville"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        />
        <input
          className="filter-input"
          placeholder="Prix max / nuit (€)"
          type="number"
          min="0"
          value={filters.max_price}
          onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
        />
        <input
          className="filter-input"
          placeholder="Chambres min"
          type="number"
          min="1"
          value={filters.min_rooms}
          onChange={(e) => setFilters({ ...filters, min_rooms: e.target.value })}
        />
        <button type="submit" className="filter-btn">Filtrer</button>
      </form>

      {loading ? (
        <p className="properties-loading">Chargement...</p>
      ) : properties.length === 0 ? (
        <p className="properties-empty">Aucune annonce trouvée.</p>
      ) : (
        <div className="properties-grid">
          {properties.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`} className="property-card">
              <h2 className="property-card-title">{p.title}</h2>
              <p className="property-card-city">{p.city}</p>
              <p className="property-card-price">
                {p.price_per_night != null ? `${p.price_per_night} € / nuit` : "Prix non renseigné"}
              </p>
              <p className="property-card-rooms">
                {p.num_rooms != null ? `${p.num_rooms} chambre(s)` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
