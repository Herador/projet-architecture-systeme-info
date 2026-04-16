import { useState } from "react";
import axios from "axios";

import {
  API_URL,
  authHeaders,
  extractApiError,
  handleApiResponse,
} from "./api";

export default function ReviewModal({ booking, config, currentUser, onClose, onCreated }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [targetType, setTargetType] = useState("property");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ratingRange = config?.review_rating_range || { min: 1, max: 5 };
  const targetTypes = config?.review_target_types || ["property", "user"];
  const reviewedId =
    targetType === "property"
      ? booking.property_id
      : currentUser?.role === "tenant"
        ? booking.owner_id
        : booking.tenant_id;

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (rating === 0) {
      setError("Veuillez sélectionner une note");
      return;
    }

    setSubmitting(true);
    axios
      .post(
        `${API_URL}/bookings/${booking.id}/reviews`,
        {
          target_type: targetType,
          reviewed_id: reviewedId,
          rating,
          comment: comment || null,
        },
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
          extractApiError(err, "Impossible d'enregistrer votre avis").message
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>Laisser un avis</h2>
        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Type d'avis</label>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
            >
              {targetTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "property" ? "Propriété" : "Propriétaire"}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Note</label>
            <div className="stars">
              {Array.from(
                { length: ratingRange.max },
                (_, index) => index + ratingRange.min
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`star ${value <= rating ? "filled" : ""}`}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Commentaire (optionnel)</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Votre avis..."
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
              disabled={submitting}
            >
              {submitting ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
