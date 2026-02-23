/**
 * Dashboard.jsx — UI principal de Gold Target App
 *
 * Cards:
 *  1. Precio — precio live, cambio del día, barra 52 semanas, sesión, botones timeframe
 *  2. Indicadores — RSI(14) con barra visual, EMA9 y EMA21 con señal de tendencia
 *  3. Targets — bullish/bearish target, ATR, status (con badge si target fue alcanzado)
 *  4. Pivot Points — R2, R1, PP, S1, S2
 *  5. Alertas — agregar/eliminar alertas de precio con notificación browser
 */

import { useEffect, useState } from 'react';
import { useGoldTarget } from '../hooks/useGoldTarget';
import {
  formatChange,
  formatElapsed,
  formatPrice,
  formatRange,
} from '../utils/format';
import {
  getMarketQuietInfo,
  getNextMarketEvent,
  getSessionName,
} from '../utils/marketTime';

// ─── Sub-componentes pequeños ─────────────────────────────────────────────────

function Row({ label, value, colorClass = 'text-white' }) {
  return (
    <div className='flex justify-between items-center text-sm'>
      <span className='text-gray-400'>{label}</span>
      <span className={colorClass}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className='border-t border-white/5 my-2' />;
}

// ─── RSI Bar ──────────────────────────────────────────────────────────────────

function RSIBar({ rsi }) {
  if (rsi == null) return <span className='text-gray-500 text-xs'>N/A</span>;

  const pct   = Math.min(Math.max(rsi, 0), 100);
  const label = rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Neutral';
  const color = rsi >= 70 ? 'bg-red-400' : rsi <= 30 ? 'bg-green-400' : 'bg-[#f5c77a]';
  const textColor = rsi >= 70 ? 'text-red-400' : rsi <= 30 ? 'text-green-400' : 'text-[#f5c77a]';

  return (
    <div className='flex items-center gap-2 flex-1 justify-end'>
      <div className='w-20 h-1.5 bg-white/10 rounded-full overflow-hidden'>
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor} w-16 text-right`}>
        {rsi.toFixed(1)} · {label}
      </span>
    </div>
  );
}

// ─── EMA Signal ───────────────────────────────────────────────────────────────

function EMASignal({ currentPrice, ema, period }) {
  if (ema == null || currentPrice == null) {
    return <span className='text-gray-500 text-xs'>N/A</span>;
  }
  const above   = currentPrice >= ema;
  const diff    = Math.abs(currentPrice - ema).toFixed(2);
  const arrow   = above ? '↑' : '↓';
  const color   = above ? 'text-green-400' : 'text-red-400';
  const signal  = above ? 'Bullish' : 'Bearish';

  return (
    <div className='text-right'>
      <span className={`text-xs font-semibold ${color}`}>
        {arrow} {formatPrice(ema)} · {signal} (${diff})
      </span>
    </div>
  );
}

// ─── 52W Bar ─────────────────────────────────────────────────────────────────

function Week52Bar({ price, low, high }) {
  if (!price || !low || !high || high === low) return null;
  const pct = Math.min(Math.max(((price - low) / (high - low)) * 100, 0), 100);

  return (
    <div className='mt-3'>
      <div className='flex justify-between text-xs text-gray-500 mb-1'>
        <span>52W Low {formatPrice(low)}</span>
        <span>High {formatPrice(high)}</span>
      </div>
      <div className='relative h-1.5 bg-white/10 rounded-full'>
        <div
          className='absolute top-0 bottom-0 bg-[#f5c77a] rounded-full'
          style={{ width: `${pct}%` }}
        />
        <div
          className='absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#f5c77a]'
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
    </div>
  );
}

// ─── Target Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'above_bullish') {
    return (
      <span className='text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400'>
        TARGET HIT ↑
      </span>
    );
  }
  if (status === 'below_bearish') {
    return (
      <span className='text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400'>
        TARGET HIT ↓
      </span>
    );
  }
  return <span className='text-xs text-gray-500'>Neutral</span>;
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const {
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
  } = useGoldTarget();

  const marketQuiet  = getMarketQuietInfo();
  const sessionName  = getSessionName();
  const nextEvent    = getNextMarketEvent();

  // Contador "Updated X ago" — solo display, no hace fetch
  const [elapsed, setElapsed] = useState(null);
  useEffect(() => {
    if (!lastUpdated) return;
    const update = () => setElapsed(Math.floor((Date.now() - lastUpdated) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Input de alerta
  const [alertInput, setAlertInput] = useState('');

  function handleAddAlert(e) {
    e.preventDefault();
    const val = parseFloat(alertInput);
    if (!isNaN(val) && val > 0) {
      addAlert(val);
      setAlertInput('');
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className='min-h-screen bg-[#0b0c10] flex items-center justify-center'>
        <div className='text-center space-y-2'>
          <div className='w-6 h-6 border-2 border-[#f5c77a] border-t-transparent rounded-full animate-spin mx-auto' />
          <p className='text-gray-400 text-sm'>Loading market data…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className='min-h-screen bg-[#0b0c10] text-red-400 flex items-center justify-center px-6 text-center'>
        <div className='space-y-3'>
          <p className='text-lg font-semibold'>Market data error</p>
          <p className='text-sm opacity-80'>{error}</p>
          <button
            onClick={refresh}
            className='mt-2 px-4 py-1.5 rounded-full bg-[#f5c77a] text-black text-sm font-semibold hover:opacity-90 transition'>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isPositive = quoteData?.change >= 0;

  return (
    <div className='min-h-screen bg-[#0b0c10] text-white p-4 flex justify-center'>
      <div className='w-full max-w-sm space-y-4 pb-8'>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className='flex items-center justify-between'>
          <span className='text-lg font-semibold text-gray-200'>Gold Target</span>
          {elapsed !== null && (
            <span className='text-xs text-gray-500'>
              Updated {formatElapsed(elapsed)}
            </span>
          )}
        </header>

        {/* ── CARD 1: Precio ────────────────────────────────────────────── */}
        <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
          <div className='flex items-start justify-between'>
            <p className='text-sm text-gray-400'>XAU/USD</p>
            <button
              onClick={refresh}
              title='Refresh'
              className='text-gray-500 hover:text-[#f5c77a] transition text-base leading-none'>
              ↻
            </button>
          </div>

          {/* Precio principal + cambio del día */}
          <div className='flex items-end gap-3 mt-1 flex-wrap'>
            <h1 className='text-3xl font-bold text-[#f5c77a]'>
              {formatPrice(price)}
            </h1>
            {quoteData && (
              <span className={`text-sm font-semibold mb-0.5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '▲' : '▼'} {formatChange(quoteData.change, quoteData.percentChange)}
              </span>
            )}
          </div>
          <p className='text-xs text-gray-500 mt-0.5'>Live Price</p>

          {/* Barra 52 semanas */}
          {quoteData?.week52High && quoteData?.week52Low && (
            <Week52Bar
              price={price}
              low={quoteData.week52Low}
              high={quoteData.week52High}
            />
          )}

          {/* Botones timeframe */}
          <div className='flex gap-2 mt-4'>
            {['1H', '4H', '1D'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                disabled={marketQuiet.quiet && tf !== '1D'}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition
                  ${timeframe === tf
                    ? 'bg-[#f5c77a] text-black'
                    : 'bg-[#1f2027] text-gray-400 hover:bg-[#2a2b32]'}
                  ${marketQuiet.quiet && tf !== '1D' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {tf}
              </button>
            ))}
          </div>

          {/* Sesión + próximo evento */}
          <div className='flex items-center justify-between mt-3'>
            <span className='text-xs text-gray-500'>
              Session: <span className='text-gray-300'>{sessionName}</span>
            </span>
            {!marketQuiet.quiet && (
              <span className='text-xs text-gray-500'>
                Next: <span className='text-gray-300'>{nextEvent.label}</span>
              </span>
            )}
          </div>

          {/* Market quiet badge */}
          {marketQuiet.quiet && (
            <>
              <div className='mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-semibold'>
                <span className='w-2 h-2 rounded-full bg-yellow-400 animate-pulse' />
                Market quiet
              </div>
              <p className='text-xs text-gray-500 mt-2'>
                {marketQuiet.reason}. Intraday data may be limited.
                <br />
                Expected activity:{' '}
                <span className='text-gray-300'>{marketQuiet.resumeAt}</span>
              </p>
            </>
          )}
        </div>

        {/* ── CARD 2: Indicadores ───────────────────────────────────────── */}
        {indicators && (
          <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
            <p className='text-sm text-gray-400 mb-3'>Indicators ({timeframe})</p>
            <div className='space-y-3'>
              <div className='flex justify-between items-center text-sm'>
                <span className='text-gray-400'>RSI (14)</span>
                <RSIBar rsi={indicators.rsi} />
              </div>
              <div className='flex justify-between items-center text-sm'>
                <span className='text-gray-400'>EMA 9</span>
                <EMASignal currentPrice={price} ema={indicators.ema9} period={9} />
              </div>
              <div className='flex justify-between items-center text-sm'>
                <span className='text-gray-400'>EMA 21</span>
                <EMASignal currentPrice={price} ema={indicators.ema21} period={21} />
              </div>
            </div>
          </div>
        )}

        {/* ── CARD 3: Targets ───────────────────────────────────────────── */}
        {data && (
          <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
            <p className='text-sm text-gray-400 mb-3'>Targets ({timeframe})</p>
            <div className='space-y-3'>
              <Row label='Close'   value={formatPrice(data.close)} />
              <div className='flex justify-between items-center text-sm'>
                <span className='text-green-400'>Bullish Target</span>
                <div className='flex items-center gap-2'>
                  {data.status === 'above_bullish' && (
                    <span className='text-xs font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400'>HIT ↑</span>
                  )}
                  <span className='text-green-400'>{formatPrice(data.bullishTarget)}</span>
                </div>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <span className='text-red-400'>Bearish Target</span>
                <div className='flex items-center gap-2'>
                  {data.status === 'below_bearish' && (
                    <span className='text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400'>HIT ↓</span>
                  )}
                  <span className='text-red-400'>{formatPrice(data.bearishTarget)}</span>
                </div>
              </div>
              <Row label='Range' value={formatRange(data.range)} colorClass='text-gray-400' />

              <Divider />

              <div className='flex justify-between items-center text-sm'>
                <span className='text-gray-400'>Status</span>
                <StatusBadge status={data.status} />
              </div>
              {data.atr != null && (
                <Row label='ATR' value={formatRange(data.atr)} colorClass='text-gray-300' />
              )}
            </div>
          </div>
        )}

        {/* ── CARD 4: Pivot Points ──────────────────────────────────────── */}
        {data?.pivots && (
          <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
            <p className='text-sm text-gray-400 mb-3'>Pivot Points ({timeframe})</p>
            <div className='space-y-3'>
              <Row label='R2' value={formatPrice(data.pivots.R2)} colorClass='text-green-400/70' />
              <Row label='R1' value={formatPrice(data.pivots.R1)} colorClass='text-green-400' />
              <Row label='PP' value={formatPrice(data.pivots.PP)} colorClass='text-gray-200' />
              <Row label='S1' value={formatPrice(data.pivots.S1)} colorClass='text-red-400' />
              <Row label='S2' value={formatPrice(data.pivots.S2)} colorClass='text-red-400/70' />
            </div>
          </div>
        )}

        {/* ── CARD 5: Alertas ───────────────────────────────────────────── */}
        <div className='bg-gradient-to-br from-[#1a1b22] to-[#121318] rounded-2xl p-5 shadow-lg'>
          <p className='text-sm text-gray-400 mb-3'>Price Alerts</p>

          {/* Input para nueva alerta */}
          <form onSubmit={handleAddAlert} className='flex gap-2 mb-3'>
            <input
              type='number'
              step='0.01'
              min='0'
              placeholder='e.g. 3300.00'
              value={alertInput}
              onChange={e => setAlertInput(e.target.value)}
              className='flex-1 bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f5c77a]/50 transition'
            />
            <button
              type='submit'
              className='px-3 py-1.5 bg-[#f5c77a] text-black text-sm font-bold rounded-xl hover:opacity-90 transition'>
              +
            </button>
          </form>

          {/* Lista de alertas activas */}
          {alerts.length === 0 ? (
            <p className='text-xs text-gray-600 text-center py-2'>
              No active alerts. Add a price level above.
            </p>
          ) : (
            <div className='space-y-2'>
              {alerts.map(alert => {
                const dist    = price ? Math.abs(price - alert.price) : null;
                const above   = price ? alert.price > price : null;
                const distStr = dist != null ? `$${dist.toFixed(2)} ${above ? 'above' : 'below'}` : '';
                return (
                  <div
                    key={alert.id}
                    className='flex items-center justify-between bg-white/5 rounded-xl px-3 py-2'>
                    <div>
                      <span className='text-sm font-semibold text-[#f5c77a]'>
                        {formatPrice(alert.price)}
                      </span>
                      {distStr && (
                        <span className='text-xs text-gray-500 ml-2'>{distStr}</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className='text-gray-600 hover:text-red-400 transition text-lg leading-none'>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
