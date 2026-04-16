export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const ERROR_CODES = {
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

export const ACTION_MESSAGES = {
  create_booking: "Réservation créée avec succès",
  update_status: "Statut mis à jour",
  cancel_booking: "Réservation annulée",
  create_review: "Avis enregistré",
  list_bookings: "Réservations chargées",
  list_reviews: "Avis chargés",
  get_config: "Configuration chargée",
};

export function handleApiResponse(response, successCallback, errorCallback) {
  const { success, data, error, action, meta } = response;

  if (success) {
    const actionMessage = action?.action ? ACTION_MESSAGES[action.action] : null;
    return successCallback(data, meta, actionMessage);
  }

  if (error) {
    const message = ERROR_CODES[error.code] || error.message;
    const canRetry = error.retry_possible !== false;
    return errorCallback(message, error.code, canRetry, error.details);
  }

  return errorCallback("Une erreur inattendue s'est produite", "UNKNOWN", true, null);
}

export function extractApiError(err, fallbackMessage) {
  const payload = err?.response?.data;

  if (payload?.error) {
    return {
      message: ERROR_CODES[payload.error.code] || payload.error.message || fallbackMessage,
      code: payload.error.code || "UNKNOWN",
      canRetry: payload.error.retry_possible !== false,
      details: payload.error.details,
    };
  }

  if (typeof payload?.detail === "string") {
    return {
      message: payload.detail,
      code: "UNKNOWN",
      canRetry: false,
      details: null,
    };
  }

  return {
    message: fallbackMessage,
    code: "UNKNOWN",
    canRetry: true,
    details: null,
  };
}

export function authHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}
