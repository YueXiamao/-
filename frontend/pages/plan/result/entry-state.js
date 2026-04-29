export function consumeTripResultEntry({
  options = {},
  getStorageSync,
  removeStorageSync
}) {
  if (options.trip_id) {
    return { mode: 'detail', tripId: options.trip_id };
  }

  const generatedTrip = getStorageSync?.('pre_generated_trip');
  if (generatedTrip) {
    removeStorageSync?.('pre_generated_trip');
    return { mode: 'generated', trip: generatedTrip };
  }

  const params = getStorageSync?.('trip_params');
  if (params) {
    removeStorageSync?.('trip_params');
    return { mode: 'generate', params };
  }

  return { mode: 'empty' };
}

export function createRetryParamsStore() {
  let current = null;

  return {
    get() {
      return current;
    },
    set(params) {
      current = params || null;
    },
    clear() {
      current = null;
    }
  };
}
