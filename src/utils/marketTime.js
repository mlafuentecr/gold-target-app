/**
 * marketTime.js — Helpers de horario de mercado forex (XAU/USD)
 * Todos los cálculos se hacen en la zona horaria de Nueva York (America/New_York).
 */

// ─── Core helper ─────────────────────────────────────────────────────────────

/**
 * Devuelve la fecha/hora actual en la zona horaria de Nueva York.
 * @returns {Date}
 */
export function getNYTime() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// ─── Market status ────────────────────────────────────────────────────────────

/**
 * Determina si el mercado de oro está en un período silencioso (cerrado o rollover).
 * El mercado forex opera de Domingo 5 PM NY a Viernes 5 PM NY, con una pausa
 * de ~1h en el rollover diario (5 PM NY cada día).
 *
 * @returns {{ quiet: boolean, reason?: string, resumeAt?: string }}
 */
export function getMarketQuietInfo() {
  const nyTime = getNYTime();
  const day = nyTime.getDay();   // 0 = Sunday, 6 = Saturday
  const hour = nyTime.getHours();

  // ── Fin de semana ─────────────────────────────────────────────────────────
  // Viernes >= 17:00 NY hasta Domingo 17:00 NY
  if (day === 5 && hour >= 17) {
    return {
      quiet: true,
      reason: 'Weekend — market closed',
      resumeAt: 'Sunday at 5:00 PM NY',
    };
  }
  if (day === 6) {
    return {
      quiet: true,
      reason: 'Weekend — market closed',
      resumeAt: 'Sunday at 5:00 PM NY',
    };
  }
  if (day === 0 && hour < 17) {
    return {
      quiet: true,
      reason: 'Weekend — market closed',
      resumeAt: 'Today (Sunday) at 5:00 PM NY',
    };
  }

  // ── Rollover diario (17:00 NY) ────────────────────────────────────────────
  if (hour === 17) {
    return {
      quiet: true,
      reason: 'Daily rollover',
      resumeAt: 'Within ~30–60 minutes',
    };
  }

  return { quiet: false };
}

/**
 * Booleano: ¿está el mercado abierto ahora mismo?
 * @returns {boolean}
 */
export function isMarketOpen() {
  return !getMarketQuietInfo().quiet;
}

// ─── Session name ──────────────────────────────────────────────────────────────

/**
 * Devuelve el nombre de la sesión forex activa según la hora de NY.
 * Nota: las sesiones se solapan, se devuelve el overlap más importante.
 *
 * Sesiones (hora NY):
 *  Sydney/Wellington: 17:00 – 02:59
 *  Tokyo/Asia:        00:00 – 08:59
 *  London/Europe:     03:00 – 11:59
 *  New York:          08:00 – 16:59
 *
 * @returns {string}
 */
export function getSessionName() {
  if (!isMarketOpen()) return 'Market Closed';

  const hour = getNYTime().getHours();

  if (hour >= 8 && hour < 12)  return 'New York / London';  // Overlap más volátil
  if (hour >= 12 && hour < 17) return 'New York';
  if (hour >= 3 && hour < 8)   return 'London / Tokyo';
  if (hour >= 0 && hour < 3)   return 'Tokyo';
  return 'Sydney / Tokyo';
}

// ─── Next market event ────────────────────────────────────────────────────────

/**
 * Devuelve el próximo evento relevante del mercado.
 * @returns {{ label: string, timeNY: string }}
 */
export function getNextMarketEvent() {
  const nyTime = getNYTime();
  const day  = nyTime.getDay();
  const hour = nyTime.getHours();

  // Si el mercado está cerrado → próximo evento es la apertura del Domingo
  if (!isMarketOpen()) {
    return { label: 'Market Open', timeNY: 'Sun 5:00 PM NY' };
  }

  // Si es Viernes y aún no son las 5 PM → próximo cierre semanal
  if (day === 5) {
    return { label: 'Weekly Close', timeNY: 'Fri 5:00 PM NY' };
  }

  // Durante la semana → próximo rollover diario
  const rolloverTodayPassed = hour >= 18;
  if (rolloverTodayPassed) {
    return { label: 'Daily Rollover', timeNY: 'Tomorrow 5:00 PM NY' };
  }
  return { label: 'Daily Rollover', timeNY: 'Today 5:00 PM NY' };
}
