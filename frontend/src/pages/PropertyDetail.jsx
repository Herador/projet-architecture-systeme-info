import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Properties.css";

const API_URL = "http://localhost:3000";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/catalog/properties/${id}`)
      .then((res) => setProperty(res.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="properties-loading">Chargement...</p>;
  if (!property) return null;

  return (
    <div className="property-detail-page">
      <h1 className="property-detail-title">{property.title}</h1>
      {(property.address || property.city) && (
        <p className="property-detail-city">
          {[property.address, property.city].filter(Boolean).join(", ")}
        </p>
      )}
      <p className="property-detail-price">
        {property.price_per_night != null
          ? `${property.price_per_night} € / nuit`
          : "Prix non renseigné"}
      </p>
      {property.num_rooms != null && (
        <p className="property-detail-rooms">{property.num_rooms} chambre(s)</p>
      )}
      {property.amenities && (
        <p className="property-detail-amenities">
          Équipements : {property.amenities}
        </p>
      )}
      {property.description && (
        <p className="property-detail-description">{property.description}</p>
      )}
      <button className="property-back-btn" onClick={() => navigate(-1)}>
        ← Retour
      </button>
    </div>
  );
}
