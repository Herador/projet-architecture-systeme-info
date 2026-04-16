import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/PropertyDetail.css";

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

  if (loading) return <div className="pd-state">Chargement…</div>;
  if (!property) return null;

  const amenityList = property.amenities
    ? property.amenities.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  return (
    <div className="pd-page">

      {/* ── Fil d'Ariane / retour ── */}
      <div className="pd-breadcrumb">
        <button className="pd-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeftIcon /> Retour
        </button>
      </div>

      {/* ── Layout principal ── */}
      <div className="pd-layout">

        {/* ── Colonne gauche : infos ── */}
        <div className="pd-left">

          <h1 className="pd-title">{property.title}</h1>

          {(property.address || property.city) && (
            <p className="pd-address">
              <PinIcon />
              {[property.address, property.city].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Stats */}
          <div className="pd-stats">
            {property.num_rooms != null && (
              <div className="pd-stat">
                <BedIcon />
                <span>{property.num_rooms} chambre{property.num_rooms > 1 ? "s" : ""}</span>
              </div>
            )}
            {amenityList.length > 0 && (
              <div className="pd-stat">
                <SparkleIcon />
                <span>{amenityList.length} équipement{amenityList.length > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          <div className="pd-divider" />

          {/* Description */}
          {property.description && (
            <div className="pd-section">
              <h2 className="pd-section-title">Description du bien</h2>
              <p className="pd-description">{property.description}</p>
            </div>
          )}

          {/* Équipements */}
          {amenityList.length > 0 && (
            <div className="pd-section">
              <h2 className="pd-section-title">Équipements</h2>
              <div className="pd-amenities">
                {amenityList.map((a) => (
                  <span key={a} className="pd-amenity-chip">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : galerie + réservation ── */}
        <div className="pd-right">

          {/* Galerie placeholder */}
          <div className="pd-gallery">
            <div className="pd-gallery-main">🏠</div>
            <div className="pd-gallery-grid">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="pd-gallery-thumb">🏠</div>
              ))}
            </div>
          </div>

          {/* Carte réservation */}
          <div className="pd-booking-card">
            <div className="pd-booking-price">
              <span className="pd-booking-amount">
                {property.price_per_night != null
                  ? `${parseFloat(property.price_per_night).toFixed(0)} €`
                  : "—"}
              </span>
              <span className="pd-booking-unit"> / nuit</span>
            </div>
            <button className="pd-booking-btn">Réserver</button>
          </div>

        </div>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
}

function BedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/>
      <path d="M2 11v6h20v-6"/>
      <path d="M2 17v2"/><path d="M22 17v2"/>
      <rect x="6" y="9" width="5" height="3" rx="1"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}
