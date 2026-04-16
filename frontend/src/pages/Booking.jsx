import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Booking.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const ERROR_CODES = {
  RESOURCE_NOT_FOUND: "Ressource introuvable",
  VALIDATION_ERROR: "Erreur de validation",
  UNAUTHORIZED: "Non autorisé",
  FORBIDDEN: "Accès refusé",
  CONFLICT: "Conflit détecté",
  INVALID_STATUS_TRANSITION: "Transition de statut impossible",
  DATE_UNAVAILABLE: "Date non disponible",
  BOOKING_OVERLAP: "Chevauchement de réservation",
  SELF_BOOKING_NOT_ALLOWED: "Vous ne pouvez pas réserver votre propre bien",
  INVALID_DATES: "Dates invalides",
  PAST_DATE_NOT_ALLOWED: "Date dans le passé non autorisée",
  ALREADY_REVIEWED: "Avis déjà existant",
  REVIEW_ONLY_PAID: "Uniquement pour réservations payées",
  CANNOT_CANCEL_PAID: "Impossible d'annuler une réservation payée",
  ALREADY_TERMINAL: "Réservation déjà terminée",
  PROPERTY_NOT_AVAILABLE: "Propriété non disponible",
  INVALID_ROLE: "Rôle invalide",
  INVALID_STATUS: "Statut invalide",
  INTERNAL_ERROR: "Erreur interne",
};

const ACTION_MESSAGES = {
  create_booking: "Réservation créée avec succès",
  update_status: "Statut mis à jour",
  cancel_booking: "Réservation annulée",
  create_review: "Avis enregistré",
  list_bookings: "Réservations chargées",
  list_reviews: "Avis chargés",
  get_config: "Configuration chargée",
};

function handleApiResponse(response, successCallback, errorCallback) {
  const { success, data, error, action, meta } = response;

  if (success) {
    if (action?.action && ACTION_MESSAGES[action.action]) {
      return successCallback(data, meta, ACTION_MESSAGES[action.action]);
    }
    return successCallback(data, meta);
  }

  if (error) {
    const message = ERROR_CODES[error.code] || error.message;
    const canRetry = error.retry_possible !== false;
    return errorCallback(message, error.code, canRetry, error.details);
  }

  return errorCallback("Une erreur inattendue s'est produite", "UNKNOWN", true);
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

export default function Booking() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchConfig();
    }
  }, [user]);

  useEffect(() => {
    if (config && user) {
      fetchBookings();
    }
  }, [config, user, filter]);

  function flash(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleError(message, code, canRetry, details) {
    if (canRetry) {
      flash(`${message}. Veuillez réessayer.`, "error");
    } else {
      flash(message, "error");
    }
  }

  function fetchConfig() {
    axios
      .get(`${API_URL}/bookings/config`)
      .then((res) => {
        handleApiResponse(
          res.data,
          (data, meta, actionMsg) => setConfig(data),
          (msg) => flash(msg, "error")
        );
      })
      .catch(() => flash("Erreur lors du chargement de la configuration", "error"));
  }

  function fetchBookings() {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    axios
      .get(`${API_URL}/bookings${params}`, { headers: authHeaders() })
      .then((res) => {
        handleApiResponse(
          res.data,
          (data, meta) => setBookings(data),
          handleError
        );
      })
      .catch(() => flash("Erreur lors du chargement des réservations", "error"))
      .finally(() => setLoading(false));
  }

  function updateStatus(bookingId, status) {
    axios
      .patch(
        `${API_URL}/bookings/${bookingId}/status`,
        { status },
        { headers: authHeaders() }
      )
      .then((res) => {
        handleApiResponse(
          res.data,
          (data, meta) => {
            const statusLabel = getStatusLabel(status);
            flash(`Réservation ${statusLabel.toLowerCase()}`);
            fetchBookings();
          },
          handleError
        );
      });
  }

  function cancelBooking(bookingId) {
    if (!confirm("Annuler cette réservation ?")) return;
    axios
      .delete(`${API_URL}/bookings/${bookingId}`, { headers: authHeaders() })
      .then((res) => {
        handleApiResponse(
          res.data,
          () => {
            flash("Réservation annulée");
            fetchBookings();
          },
          handleError
        );
      });
  }

  function toggleReviews(bookingId) {
    if (expandedReviews[bookingId]) {
      setExpandedReviews((prev) => {
        const copy = { ...prev };
        delete copy[bookingId];
        return copy;
      });
    } else {
      axios
        .get(`${API_URL}/bookings/${bookingId}/reviews`, {
          headers: authHeaders(),
        })
        .then((res) => {
          handleApiResponse(
            res.data,
            (data) => setExpandedReviews((prev) => ({ ...prev, [bookingId]: data })),
            handleError
          );
        });
    }
  }

  function getStatusLabel(status) {
    if (!config) return status;
    const found = config.booking_statuses.find((s) => s.value === status);
    return found ? found.label : status;
  }

  function getStatusTransitions(role, currentStatus) {
    if (!config || !config.status_transitions) return [];
    const roleTransitions = config.status_transitions[role] || {};
    return roleTransitions[currentStatus] || [];
  }

  function renderActions(b) {
    if (!config) return null;
    const role = user?.role;
    const actions = [];
    const transitions = getStatusTransitions(role, b.status);

    if (role === "owner") {
      transitions.forEach((status) => {
        const label = status === "accepted" ? "Accepter" : "Refuser";
        const className = status === "accepted" ? "btn-success" : "btn-danger";
        actions.push(
          <button
            key={status}
            className={`btn ${className} btn-sm`}
            onClick={() => updateStatus(b.id, status)}
          >
            {label}
          </button>
        );
      });
    }

    if (role === "tenant" || role === "admin") {
      transitions.forEach((status) => {
        if (status === "paid") {
          actions.push(
            <button
              key="pay"
              className="btn btn-primary btn-sm"
              onClick={() => updateStatus(b.id, "paid")}
            >
              Payer
            </button>
          );
        }
      });

      if (["pending", "accepted"].includes(b.status)) {
        actions.push(
          <button
            key="cancel"
            className="btn btn-danger btn-sm"
            onClick={() => cancelBooking(b.id)}
          >
            Annuler
          </button>
        );
      }
    }

    if (b.status === "paid") {
      actions.push(
        <button
          key="review"
          className="btn btn-warning btn-sm"
          onClick={() => setShowReviewModal(b)}
        >
          Laisser un avis
        </button>
      );
    }

    actions.push(
      <button
        key="reviews"
        className="btn btn-secondary btn-sm"
        onClick={() => toggleReviews(b.id)}
      >
        {expandedReviews[b.id] ? "Masquer avis" : "Voir avis"}
      </button>
    );

    return actions;
  }

  if (authLoading) return <div className="booking-loading">Chargement...</div>;
  if (!user) return null;

  const filters = config
    ? [
        { value: "", label: "Toutes" },
        ...config.booking_statuses.map((s) => ({
          value: s.value,
          label: s.label + (s.value === "pending" ? "s" : ""),
        })),
      ]
    : [];

  return (
    <div className="booking-page">
      <div className="booking-container">
        <div className="booking-header">
          <h1>Mes réservations</h1>
          {user.role === "tenant" && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Nouvelle réservation
            </button>
          )}
        </div>

        {message && (
          <div className={`booking-message ${message.type}`}>{message.text}</div>
        )}

        <div className="booking-filters">
          {filters.map((f) => (
            <button
              key={f.value}
              className={`filter-btn ${filter === f.value ? "active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="booking-loading">Chargement...</div>
        ) : bookings.length === 0 ? (
          <div className="booking-empty">
            <p>Aucune réservation trouvée</p>
          </div>
        ) : (
          <div className="booking-list">
            {bookings.map((b) => (
              <div key={b.id} className="booking-card">
                <div className="booking-card-header">
                  <div>
                    <h3 className="booking-card-title">Réservation</h3>
                    <p className="booking-card-id">#{b.id.slice(0, 8)}</p>
                  </div>
                  <span className={`status-badge status-${b.status}`}>
                    {getStatusLabel(b.status)}
                  </span>
                </div>

                <div className="booking-card-body">
                  <div className="booking-info">
                    <span className="booking-info-label">Arrivée</span>
                    <span className="booking-info-value">
                      {new Date(b.check_in).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="booking-info">
                    <span className="booking-info-label">Départ</span>
                    <span className="booking-info-value">
                      {new Date(b.check_out).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="booking-info">
                    <span className="booking-info-label">Prix total</span>
                    <span className="booking-info-value">
                      {parseFloat(b.total_price).toFixed(2)} €
                    </span>
                  </div>
                  <div className="booking-info">
                    <span className="booking-info-label">Nuits</span>
                    <span className="booking-info-value">
                      {Math.round(
                        (new Date(b.check_out) - new Date(b.check_in)) /
                          (1000 * 60 * 60 * 24)
                      )}
                    </span>
                  </div>
                </div>

                <div className="booking-card-actions">{renderActions(b)}</div>

                {expandedReviews[b.id] && (
                  <div className="reviews-section">
                    <h4>Avis ({expandedReviews[b.id].length})</h4>
                    {expandedReviews[b.id].length === 0 ? (
                      <p className="reviews-empty">Aucun avis pour cette réservation</p>
                    ) : (
                      expandedReviews[b.id].map((r) => (
                        <div key={r.id} className="review-item">
                          <div className="review-item-header">
                            <span className="review-stars">
                              {"★".repeat(r.rating)}
                              {"☆".repeat(5 - r.rating)}
                            </span>
                            <span className="review-date">
                              {new Date(r.created_at).toLocaleDateString(
                                "fr-FR"
                              )}
                            </span>
                          </div>
                          {r.comment && (
                            <p className="review-comment">{r.comment}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && config && (
        <CreateBookingModal
          config={config}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            flash("Réservation créée avec succès");
            fetchBookings();
          }}
        />
      )}

      {showReviewModal && config && (
        <ReviewModal
          booking={showReviewModal}
          config={config}
          onClose={() => setShowReviewModal(null)}
          onCreated={() => {
            setShowReviewModal(null);
            flash("Avis envoyé");
          }}
        />
      )}
    </div>
  );
}

function CreateBookingModal({ config, onClose, onCreated }) {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState("");
  const [loadingProps, setLoadingProps] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/bookings/properties`)
      .then((res) => {
        handleApiResponse(
          res.data,
          (data) => setProperties(data),
          (msg) => setError(msg)
        );
      })
      .catch(() => setError("Impossible de charger les propriétés"))
      .finally(() => setLoadingProps(false));
  }, []);

  const selected = properties.find((p) => p.id === propertyId);

  function handleSubmit(e) {
    e.preventDefault();
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
          (msg, code, canRetry) => setError(msg)
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Nouvelle réservation</h2>
        {error && <p className="form-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Propriété</label>
            {loadingProps ? (
              <p className="form-property-hint">Chargement...</p>
            ) : properties.length === 0 ? (
              <p className="form-property-hint">Aucune propriété disponible</p>
            ) : (
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                <option value="">Sélectionner une propriété</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.city || "Ville non renseignée"} —{" "}
                    {parseFloat(p.price_per_night).toFixed(0)} €/nuit
                  </option>
                ))}
              </select>
            )}
          </div>
          {selected && (
            <p className="form-property-hint">
              {selected.address && <span>{selected.address} · </span>}
              {selected.num_rooms && <span>{selected.num_rooms} pièces</span>}
            </p>
          )}
          <div className="form-group">
            <label>Date d'arrivée</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Date de départ</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
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
              disabled={submitting || loadingProps}
            >
              {submitting ? "Envoi..." : "Réserver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewModal({ booking, config, onClose, onCreated }) {
  const { user } = useAuth();
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
      : user?.role === "tenant"
        ? booking.owner_id
        : booking.tenant_id;

  function handleSubmit(e) {
    e.preventDefault();
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
          (msg, code, canRetry) => setError(msg)
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Laisser un avis</h2>
        {error && <p className="form-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Type d'avis</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
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
                (_, i) => i + ratingRange.min
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`star ${n <= rating ? "filled" : ""}`}
                  onClick={() => setRating(n)}
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
              onChange={(e) => setComment(e.target.value)}
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
