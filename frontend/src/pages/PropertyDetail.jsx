import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/PropertyDetail.css";

const API_URL = "http://localhost:3000";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/catalog/properties/${id}`)
      .then((res) => setProperty(res.data))
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

function BookingModal({ property, onClose, onSuccess, onError }) {
  const today = new Date().toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [blockedDates, setBlockedDates] = useState([]);

  const numNights =
    checkIn && checkOut
      ? Math.max(
          0,
          Math.round(
            (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  const totalPrice = property.price_per_night
    ? (parseFloat(property.price_per_night) * numNights).toFixed(2)
    : "—";

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setBlockedDates([]);
      return;
    }

    const checkAvailability = async () => {
      setCheckingAvailability(true);
      setError("");

      try {
        const res = await axios.get(
          `${API_URL}/catalog/properties/${property.id}/availability`
        );
        const blocked = (res.data || []).filter((a) => a.is_blocked);
        const blockedDateSet = new Set(blocked.map((b) => b.date.split("T")[0]));
        setBlockedDates([...blockedDateSet]);

        const requestedDates = getDatesInRange(checkIn, checkOut);
        const conflictDates = requestedDates.filter((d) =>
          blockedDateSet.has(d)
        );

        if (conflictDates.length > 0) {
          const formattedDates = conflictDates
            .slice(0, 3)
            .map((d) => formatDate(d))
            .join(", ");
          const suffix =
            conflictDates.length > 3
              ? ` et ${conflictDates.length - 3} autre(s)`
              : "";
          setError(
            `Ces dates ne sont pas disponibles (${formattedDates}${suffix})`
          );
        }
      } catch (err) {
        console.error("Erreur vérification disponibilité:", err);
      } finally {
        setCheckingAvailability(false);
      }
    };

    const timer = setTimeout(checkAvailability, 300);
    return () => clearTimeout(timer);
  }, [checkIn, checkOut, property.id]);

  function getDatesInRange(start, end) {
    const dates = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current < endDate) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  }

  function authHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!checkIn || !checkOut) {
      setError("Veuillez sélectionner vos dates de séjour");
      return;
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      setError("La date d'arrivée doit être avant la date de départ");
      return;
    }

    if (blockedDates.length > 0) {
      setError("Certaines dates sélectionnées ne sont pas disponibles");
      return;
    }

    setSubmitting(true);
    axios
      .post(
        `${API_URL}/bookings`,
        {
          property_id: property.id,
          check_in: checkIn,
          check_out: checkOut,
        },
        { headers: authHeaders() }
      )
      .then((res) => {
        const { success, error } = res.data;
        if (success) {
          onSuccess();
        } else {
          setError(error?.message || "Une erreur est survenue");
        }
      })
      .catch((err) => {
        const msg =
          err.response?.data?.error?.message || "Erreur lors de la réservation";
        setError(msg);
      })
      .finally(() => setSubmitting(false));
  }

  const hasBlockedDatesInRange =
    checkIn &&
    checkOut &&
    blockedDates.some((d) => {
      return d >= checkIn && d < checkOut;
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Réserver</h2>
        <div className="booking-property-info">
          <strong>{property.title}</strong>
          <span>{property.city}</span>
        </div>
        {error && <p className="form-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Date d'arrivée</label>
            <input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Date de départ</label>
            <input
              type="date"
              value={checkOut}
              min={checkIn || today}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          {checkingAvailability && (
            <div className="availability-checking">
              Vérification de la disponibilité...
            </div>
          )}
          {numNights > 0 && !checkingAvailability && (
            <div className="booking-summary">
              {hasBlockedDatesInRange ? (
                <div className="availability-warning">
                  ⚠️ Certaines dates ne sont pas disponibles
                </div>
              ) : (
                <div className="availability-ok">✓ Dates disponibles</div>
              )}
              <div className="booking-summary-row">
                <span>
                  {parseFloat(property.price_per_night).toFixed(0)} € ×{" "}
                  {numNights} nuit{numNights > 1 ? "s" : ""}
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
              disabled={
                submitting ||
                numNights <= 0 ||
                checkingAvailability ||
                hasBlockedDatesInRange
              }
            >
              {submitting ? "Réservation..." : "Confirmer"}
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
