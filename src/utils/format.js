/**
 * format.js — Helpers de formateo de precios e indicadores
 * Usados en Dashboard para mostrar valores de manera consistente.
 */

import { isValidNumber } from './validate';

/**
 * Formatea un precio con separador de miles y 2 decimales.
 * @param {number|string} n
 * @returns {string} Ej: "$3,285.50"
 */
export function formatPrice(n) {
  if (!isValidNumber(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formatea el cambio de precio del día con signo y porcentaje.
 * @param {number|string} val  — cambio absoluto (ej: 12.30)
 * @param {number|string} pct  — porcentaje (ej: 0.37)
 * @returns {string} Ej: "+12.30 (+0.37%)"
 */
export function formatChange(val, pct) {
  if (!isValidNumber(val) || !isValidNumber(pct)) return '—';
  const v = Number(val);
  const p = Number(pct);
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)} (${sign}${p.toFixed(2)}%)`;
}

/**
 * Formatea un valor de rango/ATR (alias semántico de formatPrice).
 * @param {number|string} n
 * @returns {string} Ej: "$42.10"
 */
export function formatRange(n) {
  return formatPrice(n);
}

/**
 * Formatea segundos en un string legible tipo "23s ago" o "just now".
 * @param {number} seconds
 * @returns {string}
 */
export function formatElapsed(seconds) {
  if (!isValidNumber(seconds) || seconds < 0) return '';
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ago`;
}
