import { Errors } from '../../middleware/errorHandler.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDestination(destination) {
  if (typeof destination === 'string') {
    const name = normalizeText(destination);
    return name ? { name, city: '', province: '' } : null;
  }

  if (!destination || typeof destination !== 'object') {
    return null;
  }

  const name = normalizeText(destination.name);
  if (!name) {
    return null;
  }

  return {
    ...destination,
    name,
    city: normalizeText(destination.city),
    province: normalizeText(destination.province)
  };
}

function normalizeDays(days) {
  if (typeof days === 'number') {
    return Number.isInteger(days) && days > 0 ? days : 0;
  }

  if (typeof days !== 'string') {
    return 0;
  }

  const trimmed = days.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return 0;
  }

  return Number.parseInt(trimmed, 10);
}

function normalizeStartDate(value) {
  const startDate = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return '';
  }

  const [yearText, monthText, dayText] = startDate.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return '';
  }

  return startDate;
}

export function normalizeGenerateTripRequest(input = {}) {
  const destinations = Array.isArray(input.destinations)
    ? input.destinations.map(normalizeDestination).filter(Boolean)
    : [];
  const start_date = normalizeStartDate(input.start_date);
  const days = normalizeDays(input.days);
  const preferences = Array.isArray(input.preferences)
    ? input.preferences.map(normalizeText).filter(Boolean)
    : [];
  const extra_notes = normalizeText(input.extra_notes);

  if (destinations.length === 0 || !start_date || !days || preferences.length === 0) {
    throw Errors.VALIDATION_ERROR('missing required parameters');
  }

  return {
    destinations,
    start_date,
    days,
    preferences,
    extra_notes
  };
}
