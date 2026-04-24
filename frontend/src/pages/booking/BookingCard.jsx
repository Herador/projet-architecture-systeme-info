import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "./api";
import {
  formatBookingDate,
  formatPrice,
  getBookingNights,
} from "./formatters";

function TenantRating({ tenantId }) {
  const [rating, setRating] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/bookings/ratings/${tenantId}?target_type=user`)
      .then((res) => setRating(res.data))
      .catch(() => {});
  }, [tenantId]);

  if (!rating?.average) return null;

  return (
    <span className="tenant-rating-badge">
      ★ {rating.average.toFixed(1)}
      <span className="tenant-rating-count">({rating.count} avis locataire)</span>
    </span>
  );
}

export default function BookingCard({
  booking,
  statusLabel,
  actions,
  reviews,
  onToggleReviews,
  perspective,
}) {
  const hasReviewsLoaded = Boolean(reviews);
  const reviewCount = reviews?.length || 0;

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div>
          <h3 className="booking-card-title">Réservation</h3>
          <p className="booking-card-id">#{booking.id.slice(0, 8)}</p>
          {perspective === "owner" && (
            <TenantRating tenantId={booking.tenant_id} />
          )}
        </div>
        <span className={`status-badge status-${booking.status}`}>
          {statusLabel}
        </span>
      </div>

      <div className="booking-card-body">
        <div className="booking-info">
          <span className="booking-info-label">Arrivée</span>
          <span className="booking-info-value">
            {formatBookingDate(booking.check_in)}
          </span>
        </div>
        <div className="booking-info">
          <span className="booking-info-label">Départ</span>
          <span className="booking-info-value">
            {formatBookingDate(booking.check_out)}
          </span>
        </div>
        <div className="booking-info">
          <span className="booking-info-label">Prix total</span>
          <span className="booking-info-value">
            {formatPrice(booking.total_price)}
          </span>
        </div>
        <div className="booking-info">
          <span className="booking-info-label">Nuits</span>
          <span className="booking-info-value">
            {getBookingNights(booking)}
          </span>
        </div>
      </div>

      <div className="booking-card-actions">
        {actions}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onToggleReviews(booking.id)}
        >
          {hasReviewsLoaded ? "Masquer avis" : "Voir avis"}
        </button>
      </div>

      {hasReviewsLoaded && (
        <div className="reviews-section">
          {(() => {
            const isOwnerPending = perspective === "owner" && booking.status === "pending";
            const filtered = isOwnerPending
              ? reviews.filter((r) => r.target_type === "user")
              : reviews.filter((r) => r.target_type === "property");
            const label = isOwnerPending ? "Avis sur le locataire" : "Avis sur le logement";
            const empty = isOwnerPending ? "Aucun avis sur ce locataire" : "Aucun avis sur le logement";
            return (
              <>
                <h4>{label} ({filtered.length})</h4>
                {filtered.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "#888" }}>{empty}</p>
                ) : (
                  filtered.map((review) => (
                    <div key={review.id} className="review-item">
                      <div className="review-item-header">
                        <span className="review-stars">
                          {"★".repeat(review.rating)}
                          {"☆".repeat(5 - review.rating)}
                        </span>
                        <span className="review-date">
                          {formatBookingDate(review.created_at)}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="review-comment">{review.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
