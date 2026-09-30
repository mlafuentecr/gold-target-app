/**
 * Eventos macro de alto impacto para el oro.
 *
 * Las horas están expresadas con offset de Nueva York. Esta lista es
 * deliberadamente pequeña: solo muestra eventos capaces de mover XAU/USD,
 * dólar y rendimientos. Debe actualizarse cuando se publique el calendario
 * oficial de nuevas fechas.
 */
const GOLD_EVENTS = [
  {
    id: 'adp-2026-09-30',
    startsAt: '2026-09-30T08:15:00-04:00',
    title: 'ADP Employment Report',
    impact: 'Alto',
    why: 'Una sorpresa en empleo puede mover el dólar y las expectativas de tasas.',
  },
  {
    id: 'pce-2026-09-30',
    startsAt: '2026-09-30T08:30:00-04:00',
    title: 'PCE / Core PCE de EE. UU.',
    impact: 'Muy alto',
    why: 'Es la inflación preferida de la Fed y puede mover directamente los rendimientos.',
  },
  {
    id: 'fomc-2026-10-27',
    startsAt: '2026-10-27T14:00:00-04:00',
    title: 'Decisión FOMC / comunicado de la Fed',
    impact: 'Muy alto',
    why: 'La reacción suele concentrarse en dólar, bonos y oro durante los primeros minutos.',
  },
];

export function getUpcomingGoldEvents(now = new Date(), windowHours = 36) {
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const windowMs = windowHours * 60 * 60 * 1000;

  return GOLD_EVENTS
    .map(event => ({ ...event, timestamp: new Date(event.startsAt).getTime() }))
    .filter(event => event.timestamp > current && event.timestamp - current <= windowMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function formatEventTime(timestamp) {
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function formatCountdown(timestamp, now = Date.now()) {
  const totalMinutes = Math.max(0, Math.floor((timestamp - now) / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `en ${days}d ${hours}h`;
  if (hours > 0) return `en ${hours}h ${minutes}m`;
  return `en ${minutes}m`;
}
