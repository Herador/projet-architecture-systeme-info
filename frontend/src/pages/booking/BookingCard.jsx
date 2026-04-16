import {
  formatBookingDate,
  formatPrice,
  getBookingNights,
} from "./formatters";

export default function BookingCard({
  booking,
  statusLabel,
  actions,
  reviews,
  onToggleReviews,
}) {
  const hasReviewsLoaded = Boolean(reviews);
  const reviewCount = reviews?.length || 0;

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div>
          <h3 className="booking-card-title">Réservation</h3>
          <p className="booking-card-id">#{booking.id.slice(0, 8)}</p>
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
          <h4>Avis ({reviewCount})</h4>
          {reviewCount === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#888" }}>
              Aucun avis pour cette réservation
            </p>
          ) : (
            reviews.map((review) => (
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
        </div>
      )}
    </div>
  );
}
