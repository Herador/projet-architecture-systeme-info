import { useEffect, useState } from "react";
import axios from "axios";

import {
  API_URL,
  authHeaders,
  extractApiError,
  handleApiResponse,
} from "./api";

export default function CreateBookingModal({ onClose, onCreated }) {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState("");
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/bookings/properties`)
      .then((res) => {
        handleApiResponse(
          res.data,
          (data) => setProperties(data),
          (message) => setError(message)
        );
      })
      .catch((err) => {
        setError(
          extractApiError(err, "Impossible de charger les propriétés").message
        );
      })
      .finally(() => setLoadingProperties(false));
  }, []);

  const selectedProperty = properties.find((property) => property.id === propertyId);

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!propertyId || !checkIn || !checkOut) {
      setError("Tous les champs sont obligatoires");
      return;
    }

    setSubmitting(true);
    axios
      .post(
        `${API_URL}/bookings`,
        { property_id: propertyId, check_in: checkIn, check_out: checkOut },
        { headers: authHeaders() }
      )
      .then((res) => {
        handleApiResponse(
          res.data,
          onCreated,
          (message) => setError(message)
        );
      })
      .catch((err) => {
        setError(
          extractApiError(err, "Impossible de créer la réservation").message
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>Nouvelle réservation</h2>
        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Propriété</label>
            {loadingProperties ? (
              <p style={{ fontSize: "0.875rem", color: "#555" }}>Chargement...</p>
            ) : properties.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "#555" }}>
                Aucune propriété disponible
              </p>
            ) : (
              <select
                value={propertyId}
                onChange={(event) => setPropertyId(event.target.value)}
              >
                <option value="">Sélectionner une propriété</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title} — {property.city || "Ville non renseignée"} —{" "}
                    {property.price_per_night != null
                      ? `${parseFloat(property.price_per_night).toFixed(0)} €/nuit`
                      : "Prix non renseigné"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedProperty && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "#555",
                marginBottom: "1rem",
              }}
            >
              {selectedProperty.address && <span>{selectedProperty.address} · </span>}
              {selectedProperty.num_rooms && (
                <span>{selectedProperty.num_rooms} pièces</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Date d'arrivée</label>
            <input
              type="date"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Date de départ</label>
            <input
              type="date"
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || loadingProperties}
            >
              {submitting ? "Envoi..." : "Réserver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
