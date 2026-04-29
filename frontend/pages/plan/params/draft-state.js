import { PREFERENCE_OPTIONS } from '../../../constants/index.js';

export function sameDestinationSelection(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;

  return left.every((item, index) => (
    item?.name === right[index]?.name && item?.level === right[index]?.level
  ));
}

export function buildPlanParamsDraftState({ destinations = [], draftParams, fallbackDate }) {
  const canReuseDraft = draftParams && sameDestinationSelection(destinations, draftParams.destinations || []);
  const preferences = canReuseDraft ? (draftParams.preferences || []) : [];

  return {
    startDate: canReuseDraft ? (draftParams.start_date || fallbackDate) : fallbackDate,
    days: canReuseDraft ? (draftParams.days || 2) : 2,
    preferences,
    extraNotes: canReuseDraft ? (draftParams.extra_notes || '') : '',
    preferenceOptions: PREFERENCE_OPTIONS.map((item) => ({
      ...item,
      selected: preferences.includes(item.value)
    }))
  };
}
