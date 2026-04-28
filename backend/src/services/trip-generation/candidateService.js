import { poiService as defaultPoiService } from '../poiService.js';

function normalizeDestinationName(destination) {
  return typeof destination === 'string' ? destination : destination?.name || '';
}

function buildCoverage(spots, foods, hotels, days) {
  const counts = {
    spots: spots.length,
    foods: foods.length,
    hotels: hotels.length,
    total: spots.length + foods.length + hotels.length
  };

  return {
    counts,
    level: counts.spots >= days && counts.foods >= days && counts.hotels >= 1 ? 'strong' : 'weak'
  };
}

function dedupeItems(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = [
      item?.type || '',
      (item?.name || '').trim().toLowerCase(),
      (item?.address || '').trim().toLowerCase()
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export class TripCandidateService {
  constructor({ poiService = defaultPoiService } = {}) {
    this.poiService = poiService;
  }

  async prepare(request) {
    const collected = {
      spots: [],
      foods: [],
      hotels: []
    };

    if (process.env.SKIP_EXTERNAL_POI === 'true') {
      return {
        spots: [],
        foods: [],
        hotels: [],
        coverage: { level: 'weak', counts: { spots: 0, foods: 0, hotels: 0 } }
      };
    }

    // Timeout wrapper: abort if any single POI call takes > 12s
    const withTimeout = (promise, ms = 12000) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`POI call timeout ${ms}ms`)), ms))
      ]);

    for (const destination of request.destinations) {
      const name = normalizeDestinationName(destination);
      const city = destination?.city || name;

      try {
        const [spots, foods, hotels] = await Promise.all([
          withTimeout(this.poiService.search({ keyword: name, type: 'spot', city, limit: 20 }).catch(() => [])),
          withTimeout(this.poiService.search({ keyword: name, type: 'food', city, limit: 10 }).catch(() => [])),
          withTimeout(this.poiService.search({ keyword: name, type: 'hotel', city, limit: 5 }).catch(() => []))
        ]);

        collected.spots.push(...(Array.isArray(spots) ? spots : []));
        collected.foods.push(...(Array.isArray(foods) ? foods : []));
        collected.hotels.push(...(Array.isArray(hotels) ? hotels : []));
      } catch (error) {
        console.error(`POI candidate preparation failed for ${name}:`, error.message);
      }
    }

    const spots = dedupeItems(collected.spots);
    const foods = dedupeItems(collected.foods);
    const hotels = dedupeItems(collected.hotels);

    return {
      spots,
      foods,
      hotels,
      coverage: buildCoverage(spots, foods, hotels, request.days)
    };
  }
}
