export function getStatusLabel(config, status) {
  if (!config) return status;
  const found = config.booking_statuses.find((item) => item.value === status);
  return found ? found.label : status;
}

export function getStatusTransitions(config, role, currentStatus) {
  if (!config?.status_transitions) return [];
  return config.status_transitions[role]?.[currentStatus] || [];
}

export function buildFilters(config) {
  if (!config) return [];
  return [
    { value: "", label: "Toutes" },
    ...config.booking_statuses.map((status) => ({
      value: status.value,
      label: status.label + (status.value === "pending" ? "s" : ""),
    })),
  ];
}

export function formatBookingDate(value) {
  return new Date(value).toLocaleDateString("fr-FR");
}

export function formatPrice(value) {
  return `${parseFloat(value).toFixed(2)} €`;
}

export function getBookingNights(booking) {
  return Math.round(
    (new Date(booking.check_out) - new Date(booking.check_in)) /
      (1000 * 60 * 60 * 24)
  );
}
