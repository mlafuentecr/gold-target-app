import { useEffect, useState } from 'react';
import { getGoldCurrentPrice, getGoldDaily, getGoldIntraday } from '../api/twelveData';
import { calculateDailyTarget } from '../services/goldTarget.service';

export function useGoldTarget() {
  const [price, setPrice] = useState(null);
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState('1D');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const current = await getGoldCurrentPrice();

        let series;

        if (timeframe === '1H') {
          series = await getGoldIntraday('1min', 60);
        } else if (timeframe === '4H') {
          series = await getGoldIntraday('15min', 16);
        } else {
          series = await getGoldDaily();
        }

        // 🔁 FALLBACK AUTOMÁTICO
        if (!series?.values?.length) {
          console.warn(`No ${timeframe} data, falling back to DAILY`);
          series = await getGoldDaily();
        }

        if (!current?.values?.length || !series?.values?.length) {
          throw new Error('Market data unavailable');
        }

        const price = Number(current.values[0].close);
        const targets = calculateDailyTarget(series);

        setPrice(price);
        setData(targets);
      } catch (err) {
        console.error('GoldTarget error:', err);
        setError('Market data temporarily unavailable');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [timeframe]);

  return { price, data, timeframe, setTimeframe, loading, error };
}
