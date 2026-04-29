function normalizeDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePreferences(preferences = []) {
  if (!Array.isArray(preferences)) return [];
  return preferences.map((item) => normalizeText(item)).filter(Boolean);
}

export function buildTripParamsFromRecommendation({
  destination = {},
  discoverParams = {},
  now = new Date()
} = {}) {
  const recommendationName = normalizeText(destination.name);
  const recommendationProvince = normalizeText(destination.province);
  const recommendationCity = normalizeText(destination.city) || recommendationName;
  const sourceProvince = normalizeText(discoverParams.province);
  const sourceCity = normalizeText(discoverParams.city);
  const days = Number.parseInt(discoverParams.days, 10) || 2;
  const preferences = normalizePreferences(discoverParams.preferences);

  return {
    destinations: [{
      name: recommendationName,
      province: recommendationProvince,
      city: recommendationCity,
      level: 'city'
    }],
    start_date: normalizeDate(now),
    days,
    preferences,
    extra_notes: [
      `来自随机玩推荐：${recommendationName}`,
      sourceCity || sourceProvince ? `出发地参考：${[sourceProvince, sourceCity].filter(Boolean).join(' ')}` : ''
    ].filter(Boolean).join('；'),
    entry_source: 'discover',
    discover_context: {
      location_mode: discoverParams.location_mode || 'manual',
      source_province: sourceProvince,
      source_city: sourceCity,
      recommendation_name: recommendationName,
      recommendation_province: recommendationProvince,
      recommendation_city: recommendationCity
    }
  };
}
