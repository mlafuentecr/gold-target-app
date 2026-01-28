export function getMarketQuietInfo() {
  const now = new Date();

  // Convertir a hora de New York
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day = nyTime.getDay(); // 0 = Sunday, 5 = Friday
  const hour = nyTime.getHours();

  // Weekend / market closed
  if ((day === 5 && hour >= 17) || day === 6 || (day === 0 && hour < 17)) {
    return {
      quiet: true,
      reason: 'Weekend / market closed',
      resumeAt: day === 0 ? 'Today at 5:00 PM NY' : 'Sunday at 5:00 PM NY',
    };
  }

  // Daily rollover window
  if (hour === 17) {
    return {
      quiet: true,
      reason: 'Daily rollover',
      resumeAt: 'Within ~30–60 minutes',
    };
  }

  return {
    quiet: false,
  };
}
