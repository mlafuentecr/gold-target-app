const API_KEY = import.meta.env.VITE_TWELVE_API_KEY;
const BASE_URL = 'https://api.twelvedata.com';

// 🔹 PRECIO ACTUAL (LIVE)
export async function getGoldLivePrice() {
  const res = await fetch(`${BASE_URL}/price?symbol=XAU/USD&apikey=${API_KEY}`);
  return res.json();
}

// 🔹 DATA DIARIA (CLOSE + RANGE)
export async function getGoldDaily() {
  const res = await fetch(
    `${BASE_URL}/time_series?symbol=XAU/USD&interval=1day&outputsize=2&apikey=${API_KEY}`
  );
  return res.json();
}

export async function getGoldCurrentPrice() {
  const res = await fetch(
    `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1min&outputsize=1&apikey=${import.meta.env.VITE_TWELVE_API_KEY}`
  );
  return res.json();
}

export async function getGoldIntraday(interval, points) {
  const res = await fetch(
    `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${points}&apikey=${import.meta.env.VITE_TWELVE_API_KEY}`
  );
  return res.json();
}
