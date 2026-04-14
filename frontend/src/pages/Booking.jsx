import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Booking.css";

const API_URL = "http://localhost:3000";

const STATUS_LABELS = {
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  paid: "Payée",
  cancelled: "Annulée",
};

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "accepted", label: "Acceptées" },
  { value: "paid", label: "Payées" },
  { value: "refused", label: "Refusées" },
  { value: "cancelled", label: "Annulées" },
];

function authHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

export default function Booking() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) fetchBookings();
  }, [user, filter]);

  function fetchBookings() {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    axios
      .get(`${API_URL}/bookings${params}`, { headers: authHeaders() })
      .then((res) => setBookings(res.data))
      .catch(() => flash("Erreur lors du chargement des réservations", "error"))
      .finally(() => setLoading(false));
  }

  function flash(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  // ── Actions sur les réservations ──────────────────────

  function updateStatus(bookingId, status) {
    axios
      .patch(
        `${API_URL}/bookings/${bookingId}/status`,
        { status },
        { headers: authHeaders() }
      )
      .then(() => {
        flash(`Réservation ${STATUS_LABELS[status].toLowerCase()}`);
        fetchBookings();
      })
      .catch((err) => flash(err.response?.data?.detail || "Erreur", "error"));
  }

  function cancelBooking(bookingId) {
    if (!confirm("Annuler cette réservation ?")) return;
    axios
      .delete(`${API_URL}/bookings/${bookingId}`, { headers: authHeaders() })
      .then(() => {
        flash("Réservation annulée");
        fetchBookings();
      })
      .catch((err) => flash(err.response?.data?.detail || "Erreur", "error"));
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
        .then((res) =>
          setExpandedReviews((prev) => ({ ...prev, [bookingId]: res.data }))
        )
        .catch(() => flash("Erreur chargement avis", "error"));
    }
  }

  // ── Rendu des actions par statut / rôle ───────────────

  function renderActions(b) {
    const role = user?.role;
    const actions = [];

    if (role === "owner") {
      if (b.status === "pending") {
        actions.push(
          <button key="accept" className="btn btn-success btn-sm" onClick={() => updateStatus(b.id, "accepted")}>
            Accepter
          </button>,
          <button key="refuse" className="btn btn-danger btn-sm" onClick={() => updateStatus(b.id, "refused")}>
            Refuser
          </button>
        );
      }
    }

    if (role === "tenant" || role === "admin") {
      if (b.status === "accepted") {
        actions.push(
          <button key="pay" className="btn btn-primary btn-sm" onClick={() => updateStatus(b.id, "paid")}>
            Payer
          </button>
        );
      }
      if (["pending", "accepted"].includes(b.status)) {
        actions.push(
          <button key="cancel" className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>
            Annuler
          </button>
        );
      }
    }

    if (b.status === "paid") {
      actions.push(
        <button key="review" className="btn btn-warning btn-sm" onClick={() => setShowReviewModal(b)}>
          Laisser un avis
        </button>
      );
    }

    actions.push(
      <button key="reviews" className="btn btn-secondary btn-sm" onClick={() => toggleReviews(b.id)}>
        {expandedReviews[b.id] ? "Masquer avis" : "Voir avis"}
      </button>
    );

    return actions;
  }

  if (authLoading) return <div className="booking-loading">Chargement...</div>;
  if (!user) return null;

  return (
    <div className="booking-page">
      <div className="booking-container">
        <div className="booking-header">
          <h1>Mes réservations</h1>
          {user.role === "tenant" && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              Nouvelle réservation
            </button>
          )}
        </div>

        {message && (
          <div className={`booking-message ${message.type}`}>{message.text}</div>
        )}

        <div className="booking-filters">
          {FILTERS.map((f) => (
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
                    <h3 className="booking-card-title">
                      Réservation
                    </h3>
                    <p className="booking-card-id">#{b.id.slice(0, 8)}</p>
                  </div>
                  <span className={`status-badge status-${b.status}`}>
                    {STATUS_LABELS[b.status]}
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
                      <p style={{ fontSize: "0.85rem", color: "#888" }}>
                        Aucun avis pour cette réservation
                      </p>
                    ) : (
                      expandedReviews[b.id].map((r) => (
                        <div key={r.id} className="review-item">
                          <div className="review-item-header">
                            <span className="review-stars">
                              {"★".repeat(r.rating)}
                              {"☆".repeat(5 - r.rating)}
                            </span>
                            <span className="review-date">
                              {new Date(r.created_at).toLocaleDateString("fr-FR")}
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

      {showCreateModal && (
        <CreateBookingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            flash("Réservation créée avec succès");
            fetchBookings();
          }}
        />
      )}

      {showReviewModal && (
        <ReviewModal
          booking={showReviewModal}
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

// ── Modal de création de réservation ──────────────────────

function CreateBookingModal({ onClose, onCreated }) {
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
      .then((res) => setProperties(res.data))
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
      .then(() => onCreated())
      .catch((err) => setError(err.response?.data?.detail || "Erreur lors de la création"))
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
              <p style={{ fontSize: "0.875rem", color: "#555" }}>Chargement...</p>
            ) : properties.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "#555" }}>Aucune propriété disponible</p>
            ) : (
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Sélectionner une propriété</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.city || "Ville non renseignée"} — {parseFloat(p.price_per_night).toFixed(0)} €/nuit
                  </option>
                ))}
              </select>
            )}
          </div>
          {selected && (
            <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
              {selected.address && <span>{selected.address} · </span>}
              {selected.num_rooms && <span>{selected.num_rooms} pièces</span>}
            </div>
          )}
          <div className="form-group">
            <label>Date d'arrivée</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Date de départ</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || loadingProps}>
              {submitting ? "Envoi..." : "Réserver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal d'avis ──────────────────────────────────────────

function ReviewModal({ booking, onClose, onCreated }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [targetType, setTargetType] = useState("property");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // L'ID de la cible est déterminé automatiquement
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
      .then(() => onCreated())
      .catch((err) => setError(err.response?.data?.detail || "Erreur lors de l'envoi"))
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
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="property">Propriété</option>
              <option value="user">{user?.role === "tenant" ? "Propriétaire" : "Locataire"}</option>
            </select>
          </div>
          <div className="form-group">
            <label>Note</label>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
