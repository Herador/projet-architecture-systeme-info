import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL, authHeaders, extractApiError } from "./api";

function StarPicker({ value, max, onChange, disabled }) {
  return (
    <div className="stars">
      {Array.from({ length: max }, (_, i) => i + 1).map((v) => (
        <button
          key={v}
          type="button"
          className={`star ${v <= value ? "filled" : ""}`}
          onClick={() => !disabled && onChange(v)}
          disabled={disabled}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewModal({ booking, config, currentUser, onClose, onCreated }) {
  const isTenant = currentUser?.id === booking.tenant_id;
  const max = config?.review_rating_range?.max || 5;

  const [propertyRating, setPropertyRating] = useState(0);
  const [propertyComment, setPropertyComment] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState({ property: false, user: false });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const reviewedUserId = isTenant ? booking.owner_id : booking.tenant_id;

  useEffect(() => {
    axios
      .get(`${API_URL}/bookings/${booking.id}/reviews`, { headers: authHeaders() })
      .then((res) => {
        const reviews = res.data?.data || [];
        const myReviews = reviews.filter((r) => r.reviewer_id === currentUser?.id);
        setAlreadyReviewed({
          property: myReviews.some((r) => r.target_type === "property"),
          user: myReviews.some((r) => r.target_type === "user"),
        });
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, [booking.id, currentUser?.id]);

  async function submitOne(target_type, reviewed_id, rating, comment) {
    if (rating === 0) return;
    try {
      await axios.post(
        `${API_URL}/bookings/${booking.id}/reviews`,
        { target_type, reviewed_id, rating, comment: comment || null },
        { headers: authHeaders() }
      );
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === "ALREADY_REVIEWED") return;
      throw err;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const hasProperty = isTenant && !alreadyReviewed.property && propertyRating > 0;
    const hasUser = !alreadyReviewed.user && userRating > 0;

    if (!hasProperty && !hasUser) {
      setError("Veuillez donner au moins une note pour un élément non encore noté");
      return;
    }

    setSubmitting(true);
    try {
      if (hasProperty) await submitOne("property", booking.property_id, propertyRating, propertyComment);
      if (hasUser) await submitOne("user", reviewedUserId, userRating, userComment);
      onCreated();
    } catch (err) {
      setError(extractApiError(err, "Impossible d'enregistrer votre avis").message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <p>Chargement…</p>
        </div>
      </div>
    );
  }

  const allDone = (isTenant ? alreadyReviewed.property : true) && alreadyReviewed.user;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Laisser un avis</h2>
        {error && <p className="form-error">{error}</p>}
        {allDone && <p className="form-info">Vous avez déjà noté tous les éléments pour cette réservation.</p>}

        <form onSubmit={handleSubmit}>
          {isTenant && (
            <div className="review-section">
              <h3 className="review-section-title">
                Le logement
                {alreadyReviewed.property && <span className="review-done"> ✓ déjà noté</span>}
              </h3>
              <StarPicker value={propertyRating} max={max} onChange={setPropertyRating} disabled={alreadyReviewed.property} />
              {!alreadyReviewed.property && (
                <textarea
                  className="review-textarea"
                  value={propertyComment}
                  onChange={(e) => setPropertyComment(e.target.value)}
                  placeholder="Votre avis sur le logement (optionnel)…"
                />
              )}
            </div>
          )}

          <div className="review-section">
            <h3 className="review-section-title">
              {isTenant ? "Le propriétaire" : "Le locataire"}
              {alreadyReviewed.user && <span className="review-done"> ✓ déjà noté</span>}
            </h3>
            <StarPicker value={userRating} max={max} onChange={setUserRating} disabled={alreadyReviewed.user} />
            {!alreadyReviewed.user && (
              <textarea
                className="review-textarea"
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                placeholder={`Votre avis sur ${isTenant ? "le propriétaire" : "le locataire"} (optionnel)…`}
              />
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {allDone ? "Fermer" : "Annuler"}
            </button>
            {!allDone && (
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Envoi…" : "Envoyer"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
