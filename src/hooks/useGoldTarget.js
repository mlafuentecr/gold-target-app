/**
 * useGoldTarget.js — Hook principal de datos de la app
 *
 * Mejoras respecto a la versión anterior:
 * - getGoldQuote: precio enriquecido (change %, 52-week range) en una sola llamada
 * - Promise.all: fetch paralelo de quote + series + indicadores (más rápido)
 * - AbortController: limpieza al desmontar o cambiar timeframe
 * - Auto-refresh cada 2 min (solo cuando el mercado está abierto)
 * - refresh(): función manual para re-fetch bajo demanda
 * - lastUpdated: timestamp del último fetch exitoso
 * - Alertas: checkAlerts + sendNotification integrados
 * - Indicadores: RSI(14), EMA9, EMA21 desde TwelveData
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getGoldDaily,
  getGoldEMA,
  getGoldIntraday,
  getGoldQuote,
  getGoldRSI,
} from '../api/twelveData';
import {
  calculateATR,
  calculatePivotPoints,
  calculateTargets,
  getPriceStatus,
} from '../services/goldTarget.service';
import { extractOHLC } from '../utils/ohlc';
import {
  checkAlerts,
  addAlert as persistAddAlert,
  getAlerts,
  removeAlert as persistRemoveAlert,
  requestNotificationPermission,
  sendNotification,
} from '../utils/alerts';
import { isMarketOpen } from '../utils/marketTime';
import { isValidNumber } from '../utils/validate';

// Mapeo de timeframe de la UI al intervalo de TwelveData para indicadores
const TF_INTERVAL = { '1H': '1min', '4H': '15min', '1D': '1day' };

// Intervalo de auto-refresh en milisegundos (2 minutos)
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

export function useGoldTarget() {
  const [price, setPrice]           = useState(null);
  const [quoteData, setQuoteData]   = useState(null);  // change, %, 52w
  const [data, setData]             = useState(null);  // targets, pivots, atr, status
  const [indicators, setIndicators] = useState(null);  // rsi, ema9, ema21
  const [timeframe, setTimeframe]   = useState('1D');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [alerts, setAlerts]         = useState(() => getAlerts());
  const [retryCount, setRetryCount] = useState(0);

  // Precio anterior para detectar cruces de alerta
  const prevPriceRef = useRef(null);

  // Pedir permiso de notificaciones al montar (solo una vez)
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ── Fetch principal ────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function fetchSeries() {
      if (timeframe === '1H') return getGoldIntraday('1min', 60, signal);
      if (timeframe === '4H') return getGoldIntraday('15min', 16, signal);
      return getGoldDaily(signal);
    }

    // Intervalo de TwelveData para indicadores
    // Los endpoints de indicadores no aceptan '1min', usar '1h' para 1H
    function indicatorInterval() {
      if (timeframe === '1H') return '1h';
      if (timeframe === '4H') return '4h';
      return '1day';
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // ── Fetch paralelo: quote + series + indicadores ──────────────────
        const tfInterval = indicatorInterval();

        const [quoteJson, seriesJson, rsiJson, ema9Json, ema21Json] = await Promise.all([
          getGoldQuote(signal),
          fetchSeries(),
          getGoldRSI(tfInterval, signal).catch(() => null),   // indicadores no bloquean
          getGoldEMA(tfInterval, 9, signal).catch(() => null),
          getGoldEMA(tfInterval, 21, signal).catch(() => null),
        ]);

        // ── Validar quote ─────────────────────────────────────────────────
        const livePrice = Number(quoteJson?.close ?? quoteJson?.price);
        if (!isValidNumber(livePrice)) {
          throw new Error('Invalid price data from API');
        }

        // ── Validar series (fallback a diario si falla intraday) ──────────
        let series = seriesJson;
        if (!series?.values?.length) {
          console.warn(`No ${timeframe} data, fallback → DAILY`);
          series = await getGoldDaily(signal);
        }
        if (!series?.values?.length) {
          throw new Error('Market data unavailable');
        }

        // ── Calcular targets ──────────────────────────────────────────────
        const targets = calculateTargets(series);
        if (!targets) throw new Error('Failed to calculate targets');

        const candles  = extractOHLC(series.values);
        const atr      = calculateATR(candles);
        const pivots   = calculatePivotPoints(targets.high, targets.low, targets.close);
        const status   = getPriceStatus(livePrice, targets);

        // ── Extraer datos del quote ───────────────────────────────────────
        const change        = Number(quoteJson?.change ?? 0);
        const percentChange = Number(quoteJson?.percent_change ?? 0);
        const prevClose     = Number(quoteJson?.previous_close ?? 0);
        const week52High    = Number(quoteJson?.fifty_two_week?.high ?? 0);
        const week52Low     = Number(quoteJson?.fifty_two_week?.low ?? 0);

        // ── Extraer indicadores ───────────────────────────────────────────
        const rsi  = rsiJson?.values?.[0]?.rsi  ? +Number(rsiJson.values[0].rsi).toFixed(1)  : null;
        const ema9 = ema9Json?.values?.[0]?.ema  ? +Number(ema9Json.values[0].ema).toFixed(2) : null;
        const ema21= ema21Json?.values?.[0]?.ema ? +Number(ema21Json.values[0].ema).toFixed(2): null;

        // ── Verificar alertas ─────────────────────────────────────────────
        const prevPrice = prevPriceRef.current;
        if (prevPrice !== null) {
          const activeAlerts = getAlerts();
          const { triggered, remaining } = checkAlerts(livePrice, prevPrice, activeAlerts);

          if (triggered.length > 0) {
            triggered.forEach(alert => {
              const dir = alert.direction === 'up' ? '↑' : '↓';
              sendNotification(
                `Gold Alert ${dir}`,
                `XAU/USD crossed $${alert.price.toFixed(2)} — now at $${livePrice.toFixed(2)}`
              );
            });
            setAlerts(remaining);
          }
        }
        prevPriceRef.current = livePrice;

        // ── Actualizar estado ─────────────────────────────────────────────
        setPrice(livePrice);
        setQuoteData({
          change:        isValidNumber(change) ? +change.toFixed(2) : 0,
          percentChange: isValidNumber(percentChange) ? +percentChange.toFixed(2) : 0,
          prevClose:     isValidNumber(prevClose) ? +prevClose.toFixed(2) : null,
          week52High:    isValidNumber(week52High) && week52High > 0 ? +week52High.toFixed(2) : null,
          week52Low:     isValidNumber(week52Low)  && week52Low > 0  ? +week52Low.toFixed(2)  : null,
        });
        setData({ ...targets, atr, pivots, status });
        setIndicators({ rsi, ema9, ema21 });
        setLastUpdated(Date.now());

      } catch (err) {
        if (err.name === 'AbortError') return; // cancelación limpia, no es un error
        console.error('GoldTarget fetch error:', err.message);
        setError(err.message || 'Market data temporarily unavailable');
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [timeframe, retryCount]);

  // ── Auto-refresh cada 2 minutos (solo mercado abierto) ────────────────────
  useEffect(() => {
    if (!isMarketOpen()) return;

    const id = setInterval(() => {
      setRetryCount(c => c + 1);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [timeframe]); // reiniciar al cambiar timeframe

  // ── API pública del hook ──────────────────────────────────────────────────

  const refresh = useCallback(() => {
    setRetryCount(c => c + 1);
  }, []);

  const addAlert = useCallback((price) => {
    const updated = persistAddAlert(price);
    setAlerts(updated);
  }, []);

  const removeAlert = useCallback((id) => {
    const updated = persistRemoveAlert(id);
    setAlerts(updated);
  }, []);

  return {
    price,
    quoteData,
    data,
    indicators,
    timeframe,
    setTimeframe,
    loading,
    error,
    lastUpdated,
    refresh,
    alerts,
    addAlert,
    removeAlert,
  };
}
