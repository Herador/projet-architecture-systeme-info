import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../context/AuthContext";
import "../styles/Booking.css";
import {
  API_URL,
  authHeaders,
  extractApiError,
  handleApiResponse,
} from "./booking/api";
import BookingCard from "./booking/BookingCard";
import CreateBookingModal from "./booking/CreateBookingModal";
import ReviewModal from "./booking/ReviewModal";
import {
  buildFilters,
  getStatusLabel,
  getStatusTransitions,
} from "./booking/formatters";

export default function Booking() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("mine");
  const [message, setMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user) {
      fetchConfig();
    }
  }, [user]);

  useEffect(() => {
    if (config && user) {
      fetchBookings();
    }
  }, [config, filter, user]);

  function flash(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleError(message, code, canRetry) {
    if (canRetry) {
      flash(`${message}. Veuillez réessayer.`, "error");
      return;
    }
    flash(message, "error");
  }

  function buildErrorHandler(fallbackMessage, callback = handleError) {
    return (err) => {
      const apiError = extractApiError(err, fallbackMessage);
      callback(apiError.message, apiError.code, apiError.canRetry, apiError.details);
    };
  }

  function fetchConfig() {
    axios
      .get(`${API_URL}/bookings/config`)
      .then((res) => {
        handleApiResponse(
          res.data,
          (data) => setConfig(data),
          (errorMessage) => flash(errorMessage, "error")
        );
      })
      .catch(buildErrorHandler("Erreur lors du chargement de la configuration", (message) => {
        flash(message, "error");
      }));
  }

  function fetchBookings() {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    axios
      .get(`${API_URL}/bookings${params}`, { headers: authHeaders() })
      .then((res) => {
        handleApiResponse(
          res.data,
          (data) => setBookings(data),
          handleError
        );
      })
      .catch(buildErrorHandler("Erreur lors du chargement des réservations"))
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
          () => {
            flash(`Réservation ${getStatusLabel(config, status).toLowerCase()}`);
            fetchBookings();
          },
          handleError
        );
      })
      .catch(buildErrorHandler("Erreur lors de la mise à jour de la réservation"));
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
      })
      .catch(buildErrorHandler("Erreur lors de l'annulation de la réservation"));
  }

  function toggleReviews(bookingId) {
    if (expandedReviews[bookingId]) {
      setExpandedReviews((prev) => { const n = { ...prev }; delete n[bookingId]; return n; });
      return;
    }

    const booking = [...myBookings, ...receivedBookings].find((b) => b.id === bookingId);
    const isOwnerPending = activePerspective === "owner" && booking?.status === "pending";

    if (isOwnerPending) {
      axios
        .get(`${API_URL}/bookings/reviews/about/${booking.tenant_id}?target_type=user`)
        .then((res) => {
          setExpandedReviews((prev) => ({ ...prev, [bookingId]: res.data }));
        })
        .catch(buildErrorHandler("Erreur lors du chargement des avis"));
    } else {
      axios
        .get(`${API_URL}/bookings/${bookingId}/reviews`, { headers: authHeaders() })
        .then((res) => {
          handleApiResponse(
            res.data,
            (data) => setExpandedReviews((prev) => ({ ...prev, [bookingId]: data })),
            handleError
          );
        })
        .catch(buildErrorHandler("Erreur lors du chargement des avis"));
    }
  }

  function renderActions(booking, perspective) {
    if (!config) return null;

    const actions = [];
    const transitions = getStatusTransitions(config, perspective, booking.status);

    if (perspective === "owner") {
      transitions.forEach((status) => {
        const isAccepted = status === "accepted";
        actions.push(
          <button
            key={status}
            className={`btn ${isAccepted ? "btn-success" : "btn-danger"} btn-sm`}
            onClick={() => updateStatus(booking.id, status)}
          >
            {isAccepted ? "Accepter" : "Refuser"}
          </button>
        );
      });
    }

    if (perspective === "tenant") {
      if (transitions.includes("paid")) {
        actions.push(
          <button
            key="pay"
            className="btn btn-primary btn-sm"
            onClick={() => updateStatus(booking.id, "paid")}
          >
            Payer
          </button>
        );
      }

      if (["pending", "accepted"].includes(booking.status)) {
        actions.push(
          <button
            key="cancel"
            className="btn btn-danger btn-sm"
            onClick={() => cancelBooking(booking.id)}
          >
            Annuler
          </button>
        );
      }

      if (booking.status === "paid") {
        actions.push(
          <button
            key="review"
            className="btn btn-warning btn-sm"
            onClick={() => setShowReviewModal(booking)}
          >
            Laisser un avis
          </button>
        );
      }
    }

    return actions;
  }

  if (authLoading) return <div className="booking-loading">Chargement...</div>;
  if (!user) return null;

  const filters = buildFilters(config);

  const myBookings = bookings.filter((b) => b.tenant_id === user.id);
  const receivedBookings = bookings.filter((b) => b.owner_id === user.id);

  const activeList = tab === "mine" ? myBookings : receivedBookings;
  const activePerspective = tab === "mine" ? "tenant" : "owner";
  const filteredList = filter ? activeList.filter((b) => b.status === filter) : activeList;

  return (
    <div className="booking-page">
      <div className="booking-container">
        <div className="booking-header">
          <h1>Réservations</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Nouvelle réservation
          </button>
        </div>

        {message && (
          <div className={`booking-message ${message.type}`}>{message.text}</div>
        )}

        <div className="booking-tabs">
          <button
            className={`booking-tab ${tab === "mine" ? "active" : ""}`}
            onClick={() => { setTab("mine"); setFilter(""); }}
          >
            Mes réservations
            {myBookings.length > 0 && (
              <span className="booking-tab-badge">{myBookings.length}</span>
            )}
          </button>
          <button
            className={`booking-tab ${tab === "received" ? "active" : ""}`}
            onClick={() => { setTab("received"); setFilter(""); }}
          >
            Demandes reçues
            {receivedBookings.length > 0 && (
              <span className="booking-tab-badge">{receivedBookings.length}</span>
            )}
          </button>
        </div>

        <div className="booking-filters">
          {filters.map((currentFilter) => (
            <button
              key={currentFilter.value}
              className={`filter-btn ${filter === currentFilter.value ? "active" : ""}`}
              onClick={() => setFilter(currentFilter.value)}
            >
              {currentFilter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="booking-loading">Chargement...</div>
        ) : filteredList.length === 0 ? (
          <div className="booking-empty"><p>Aucune réservation</p></div>
        ) : (
          <div className="booking-list">
            {filteredList.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                statusLabel={getStatusLabel(config, booking.status)}
                actions={renderActions(booking, activePerspective)}
                reviews={expandedReviews[booking.id]}
                onToggleReviews={toggleReviews}
                perspective={activePerspective}
              />
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

      {showReviewModal && config && (
        <ReviewModal
          booking={showReviewModal}
          config={config}
          currentUser={user}
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
