import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import AvailabilityCalendar from "./booking/AvailabilityCalendar";
import "../styles/PropertyDetail.css";
import "../styles/Booking.css";

const API_URL = "http://localhost:3000";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [startingConversation, setStartingConversation] = useState(false);
  const [propertyRating, setPropertyRating] = useState(null);
  const [ownerRating, setOwnerRating] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/catalog/properties/${id}`)
      .then((res) => {
        const prop = res.data;
        setProperty(prop);
        axios.get(`${API_URL}/bookings/ratings/${prop.id}?target_type=property`)
          .then((r) => setPropertyRating(r.data));
        if (prop.owner_id) {
          axios.get(`${API_URL}/bookings/ratings/${prop.owner_id}?target_type=user`)
            .then((r) => setOwnerRating(r.data));
        }
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (!authLoading && !user && showBookingModal) {
      setShowBookingModal(false);
      navigate("/login");
    }
  }, [authLoading, user, showBookingModal, navigate]);

  if (loading) return <div className="pd-state">Chargement…</div>;
  if (!property) return null;

  const amenityList = property.amenities
    ? property.amenities.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  async function handleStartConversation() {
    if (!user) {
      navigate("/login");
      return;
    }
    setStartingConversation(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/interactions/conversations`,
        { property_id: property.id, tenant_id: user.id, owner_id: property.owner_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/messages?conversation=${res.data.id}`);
    } catch (err) {
      flash(err.response?.data?.detail || "Impossible de démarrer la conversation", "error");
    } finally {
      setStartingConversation(false);
    }
  }

  function flash(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="pd-page">
      {message && (
        <div className={`pd-message pd-message--${message.type}`}>
          {message.text}
        </div>
      )}

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

          <div className="pd-ratings">
            <span className="pd-rating-badge">
              <StarFilledIcon />
              {propertyRating?.average != null
                ? <>{propertyRating.average.toFixed(1)} <span className="pd-rating-count">({propertyRating.count} avis logement)</span></>
                : <span className="pd-rating-none">Logement non encore noté</span>
              }
            </span>
            <span className="pd-rating-badge pd-rating-badge--owner">
              <StarFilledIcon />
              {ownerRating?.average != null
                ? <>{ownerRating.average.toFixed(1)} <span className="pd-rating-count">({ownerRating.count} avis propriétaire)</span></>
                : <span className="pd-rating-none">Propriétaire non encore noté</span>
              }
            </span>
          </div>

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
            {user?.id === property.owner_id ? (
              <button
                className="pd-booking-btn"
                onClick={() => navigate(`/properties/${property.id}/edit`)}
              >
                Modifier l'annonce
              </button>
            ) : (
              <>
                <button
                  className="pd-booking-btn"
                  onClick={() => {
                    if (!user) {
                      navigate("/login");
                      return;
                    }
                    setShowBookingModal(true);
                  }}
                >
                  Réserver
                </button>
                {user && (
                  <button
                    className="pd-contact-btn"
                    onClick={handleStartConversation}
                    disabled={startingConversation}
                  >
                    <ChatIcon />
                    {startingConversation ? "Connexion…" : "Contacter le propriétaire"}
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {showBookingModal && property && (
        <BookingModal
          property={property}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => {
            setShowBookingModal(false);
            flash("Réservation créée avec succès !");
          }}
          onError={(msg) => flash(msg, "error")}
        />
      )}
    </div>
  );
}

function BookingModal({ property, onClose, onSuccess }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blockedDates, setBlockedDates] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/catalog/properties/${property.id}/availability`)
      .then((res) => {
        const blocked = (res.data || [])
          .filter((a) => a.is_blocked)
          .map((a) => a.date.split("T")[0]);
        setBlockedDates(blocked);
      })
      .catch(() => {})
      .finally(() => setLoadingAvailability(false));
  }, [property.id]);

  const numNights =
    checkIn && checkOut
      ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
      : 0;

  const totalPrice = property.price_per_night
    ? (parseFloat(property.price_per_night) * numNights).toFixed(2)
    : "—";

  function handleSubmit(e) {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setError("Veuillez sélectionner vos dates sur le calendrier");
      return;
    }
    setError("");
    setSubmitting(true);
    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_URL}/bookings`,
        { property_id: property.id, check_in: checkIn, check_out: checkOut },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        const { success, error } = res.data;
        if (success) onSuccess();
        else setError(error?.message || "Une erreur est survenue");
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || "Erreur lors de la réservation");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <h2>Réserver</h2>
        <div className="booking-property-info">
          <strong>{property.title}</strong>
          <span>{property.city}</span>
        </div>

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          {loadingAvailability ? (
            <div className="availability-checking">Chargement des disponibilités…</div>
          ) : (
            <AvailabilityCalendar
              blockedDates={blockedDates}
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(ci, co) => { setCheckIn(ci); setCheckOut(co); setError(""); }}
            />
          )}

          {numNights > 0 && (
            <div className="booking-summary">
              <div className="availability-ok">✓ Dates disponibles</div>
              <div className="booking-summary-row">
                <span>
                  {parseFloat(property.price_per_night).toFixed(0)} € × {numNights} nuit{numNights > 1 ? "s" : ""}
                </span>
                <span>{totalPrice} €</span>
              </div>
              <div className="booking-summary-total">
                <strong>Total</strong>
                <strong>{totalPrice} €</strong>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !checkIn || !checkOut}
            >
              {submitting ? "Réservation…" : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4" />
      <path d="M2 11v6h20v-6" />
      <path d="M2 17v2" />
      <path d="M22 17v2" />
      <rect x="6" y="9" width="5" height="3" rx="1" />
    </svg>
  );
}

function StarFilledIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}
