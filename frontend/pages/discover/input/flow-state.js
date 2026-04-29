export function formatLocationText(province, city) {
  if (province?.name && city?.name) return `${province.name} ${city.name}`;
  if (province?.name) return province.name;
  if (city?.name) return city.name;
  return '';
}

export function buildCityPickerState(province, cityList = []) {
  return {
    pickerStep: 'city',
    currentProvince: province ? { code: province.code || '', name: province.name || '' } : null,
    currentCity: null,
    cityList,
    filteredList: cityList,
    searchValue: ''
  };
}

export function buildManualLocationSelection(currentProvince, currentCity) {
  return {
    locationMode: 'manual',
    currentProvince,
    currentCity,
    locationText: formatLocationText(currentProvince, currentCity)
  };
}

function normalizeDays(days) {
  const parsed = Number.parseInt(days, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
}

function normalizePreferences(preferences = []) {
  if (!Array.isArray(preferences)) return [];
  return [...new Set(preferences.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 3);
}

export function buildDiscoverParamsDraft({
  locationMode,
  currentProvince,
  currentCity,
  days,
  budget,
  preferences
} = {}) {
  return {
    location_mode: locationMode || 'manual',
    province: currentProvince?.name || '',
    city: currentCity?.name || '',
    days: normalizeDays(days),
    budget: String(budget || '').trim(),
    preferences: normalizePreferences(preferences)
  };
}

export function buildDiscoverRecommendRequest(params = {}) {
  return {
    current_location: {
      city: params.city || '',
      province: params.province || ''
    },
    days: normalizeDays(params.days),
    budget: params.budget || '1000-2000',
    preferences: normalizePreferences(params.preferences)
  };
}
