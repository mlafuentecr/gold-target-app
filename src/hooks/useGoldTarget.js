/**
 * useGoldTarget.js — Hook principal de datos de la app
 *
 * ARQUITECTURA DIVIDIDA EN DOS EFFECTS (fix del error 429 de TwelveData):
 *
 * Effect 1 — "Price Refresh" [retryCount]
 *   → Llama a TwelveData para precio + OHLC diario
 *   → Calcula targets y pivots del OHLC diario del spot
 *   → Chequea alarma de rebote (Zustand) y alertas de precio (localStorage)
 *   → Auto-refresh cada 2 min (solo mercado abierto)
 *
 * Effect 2 — "Indicators Refresh" [timeframe]
 *   → Llama RSI + EMA9 + EMA21 + time_series a TwelveData
 *   → Solo corre cuando el usuario CAMBIA el timeframe
 *   → 4 créditos TwelveData — una sola vez por cambio
 *   → Actualiza indicators y ATR sin tocar el precio
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
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
  getPriceStatus,
} from '../services/goldTarget.service';
import { useGoldStore } from '../store/goldStore';
import { extractOHLC } from '../utils/ohlc';
import {
  addAlert as persistAddAlert,
  checkAlerts,
  getAlerts,
  removeAlert as persistRemoveAlert,
  requestNotificationPermission,
  sendNotification,
} from '../utils/alerts';
import { isMarketOpen } from '../utils/marketTime';
import { isValidNumber } from '../utils/validate';

// 2 minutos = 30 req/hora, suficiente para el polling de precio
const PRICE_REFRESH_MS = 2 * 60 * 1000;

export function useGoldTarget() {
  const [price, setPrice]             = useState(null);
  const [quoteData, setQuoteData]     = useState(null);   // change, %, prevClose
  const [data, setData]               = useState(null);   // targets, pivots, atr, status
  const [indicators, setIndicators]   = useState(null);   // rsi, ema9, ema21
  const [timeframe, setTimeframe]     = useState('1D');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [priceSource, setPriceSource] = useState('TwelveData');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [alerts, setAlerts]           = useState(() => getAlerts());
  const [retryCount, setRetryCount]   = useState(0);

  const prevPriceRef = useRef(null);

  // Zustand: alarma de rebote
  const { checkBounceAlarm, supportLevel } = useGoldStore();

  // Pedir permiso de notificaciones al montar
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ── Effect 1: Price Refresh — TwelveData ──────────────────────────────────
  // Solo depende de retryCount (NO de timeframe).
  // El auto-refresh y el botón refresh incrementan retryCount.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadPrice() {
      try {
        setError(null);

        const [quote, daily] = await Promise.all([
          getGoldQuote(signal),
          getGoldDaily(signal),
        ]);

        const currentCandle = daily?.values?.[0];
        const previousCandle = daily?.values?.[1];

        const spot = {
          price: Number(quote.price ?? quote.close ?? currentCandle?.close),
          open_price: Number(currentCandle?.open ?? quote.open),
          high_price: Number(currentCandle?.high ?? quote.high),
          low_price: Number(currentCandle?.low ?? quote.low),
          ch: Number(quote.change ?? 0),
          chp: Number(quote.percent_change ?? 0),
          prev_close_price: Number(quote.previous_close ?? previousCandle?.close ?? 0),
          timestamp: Number(quote.last_quote_at ?? quote.timestamp ?? Date.now() / 1000),
        };

        // Validar precio
        const livePrice = Number(spot.price);
        if (!isValidNumber(livePrice)) {
          throw new Error('TwelveData devolvió un precio inválido');
        }

        // OHLC diario del spot (open/high/low/price)
        const open  = Number(spot.open_price);
        const high  = Number(spot.high_price);
        const low   = Number(spot.low_price);
        const close = livePrice;
        const range = high - low;

        // Targets (range breakout: Bullish = High + Range, Bearish = Low - Range)
        const targets = {
          open:          +open.toFixed(2),
          high:          +high.toFixed(2),
          low:           +low.toFixed(2),
          close:         +close.toFixed(2),
          bullishTarget: +(high + range).toFixed(2),
          bearishTarget: +(low  - range).toFixed(2),
          range:         +range.toFixed(2),
        };

        const pivots = calculatePivotPoints(high, low, close);
        const status = getPriceStatus(livePrice, targets);

        // Cambio del día
        const change        = Number(spot.ch  ?? 0);
        const percentChange = Number(spot.chp ?? 0);
        const prevClose     = Number(spot.prev_close_price ?? 0);

        // ── Alarma de rebote (Zustand store) ─────────────────────────────
        const prevPrice = prevPriceRef.current;
        const bounced   = checkBounceAlarm(prevPrice, livePrice);
        if (bounced) {
          toast.success(
            `¡Rebote en soporte! Oro en $${livePrice.toFixed(2)} — Posible entrada long 🚀`,
            { duration: 10000 }
          );
          sendNotification(
            '¡Rebote en soporte alcista! 🚀',
            `XAU/USD cruzó soporte $${Number(supportLevel).toFixed(2)} → ahora $${livePrice.toFixed(2)}`
          );
        }

        // ── Alertas de precio (localStorage) ─────────────────────────────
        if (prevPrice !== null) {
          const activeAlerts = getAlerts();
          const { triggered, remaining } = checkAlerts(livePrice, prevPrice, activeAlerts);
          if (triggered.length > 0) {
            triggered.forEach(alert => {
              const dir = alert.direction === 'up' ? '↑' : '↓';
              sendNotification(
                `Gold Alert ${dir}`,
                `XAU/USD cruzó $${alert.price.toFixed(2)} → ahora $${livePrice.toFixed(2)}`
              );
            });
            setAlerts(remaining);
          }
        }
        prevPriceRef.current = livePrice;

        // Actualizar estado (preservando atr e indicators del último fetch de timeframe)
        setPrice(livePrice);
        setQuoteData({
          change:        isValidNumber(change) ? +change.toFixed(2) : 0,
          percentChange: isValidNumber(percentChange) ? +percentChange.toFixed(2) : 0,
          prevClose:     isValidNumber(prevClose) && prevClose > 0 ? +prevClose.toFixed(2) : null,
          week52High:    isValidNumber(quote?.fifty_two_week?.high) ? +Number(quote.fifty_two_week.high).toFixed(2) : null,
          week52Low:     isValidNumber(quote?.fifty_two_week?.low) ? +Number(quote.fifty_two_week.low).toFixed(2) : null,
        });
        setData(prev => ({
          ...targets,
          atr:    prev?.atr    ?? null,
          pivots,
          status,
        }));
        setPriceSource('TwelveData');
        setLastUpdated(Date.now());

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Price provider error:', err.message);
        setError(err.message || 'Error al obtener precio del mercado');
      } finally {
        setLoading(false);
      }
    }

    loadPrice();
    return () => controller.abort();
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Indicators Refresh — TwelveData ────────────────────────────
  // Solo corre al CAMBIAR el timeframe (no en el polling de precio).
  // Esto limita TwelveData a ~4 créditos por cambio de timeframe → sin 429.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    function indicatorInterval() {
      if (timeframe === '1H') return '1h';
      if (timeframe === '4H') return '4h';
      return '1day';
    }

    async function loadIndicators() {
      try {
        const tfInterval = indicatorInterval();

        const fetchSeries = () => {
          if (timeframe === '1H') return getGoldIntraday('1min', 60, signal);
          if (timeframe === '4H') return getGoldIntraday('15min', 16, signal);
          return getGoldDaily(signal);
        };

        const [seriesJson, rsiJson, ema9Json, ema21Json] = await Promise.all([
          fetchSeries(),
          getGoldRSI(tfInterval, signal).catch(() => null),
          getGoldEMA(tfInterval, 9, signal).catch(() => null),
          getGoldEMA(tfInterval, 21, signal).catch(() => null),
        ]);

        // ATR desde series de velas
        let atr = null;
        if (seriesJson?.values?.length) {
          const candles = extractOHLC(seriesJson.values);
          atr = calculateATR(candles);
        }

        const rsi   = rsiJson?.values?.[0]?.rsi   ? +Number(rsiJson.values[0].rsi).toFixed(1)   : null;
        const ema9  = ema9Json?.values?.[0]?.ema   ? +Number(ema9Json.values[0].ema).toFixed(2)  : null;
        const ema21 = ema21Json?.values?.[0]?.ema  ? +Number(ema21Json.values[0].ema).toFixed(2) : null;

        setData(prev => prev ? { ...prev, atr } : null);
        setIndicators({ rsi, ema9, ema21 });

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Indicators fetch failed (non-blocking):', err.message);
        // No bloquea la app si los indicadores fallan
      }
    }

    loadIndicators();
    return () => controller.abort();
  }, [timeframe]);

  // ── Auto-refresh de precio (solo mercado abierto) ─────────────────────────
  useEffect(() => {
    if (!isMarketOpen()) return;
    const id = setInterval(() => setRetryCount(c => c + 1), PRICE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // ── API pública ───────────────────────────────────────────────────────────

  const refresh = useCallback(() => setRetryCount(c => c + 1), []);

  const addAlert = useCallback((price) => {
    setAlerts(persistAddAlert(price));
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(persistRemoveAlert(id));
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
    priceSource,
    lastUpdated,
    refresh,
    alerts,
    addAlert,
    removeAlert,
  };
}
