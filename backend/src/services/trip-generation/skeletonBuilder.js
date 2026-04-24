function getDestinationName(request, index) {
  const destination = request.destinations[index % request.destinations.length];
  return typeof destination === 'string' ? destination : destination?.name || 'Destination';
}

function formatDay(startDate, offset) {
  const [yearText, monthText, dayText] = startDate.split('-');
  const current = new Date(Date.UTC(
    Number.parseInt(yearText, 10),
    Number.parseInt(monthText, 10) - 1,
    Number.parseInt(dayText, 10) + offset
  ));

  return current.toISOString().slice(0, 10);
}

function normalizeSpot(candidate, destinationName, dayNumber) {
  if (candidate) {
    return {
      type: 'spot',
      name: candidate.name || `${destinationName} highlight`,
      address: candidate.address || destinationName,
      duration: candidate.duration || '2-3h',
      description: candidate.description || `Core sightseeing block for day ${dayNumber}.`,
      transport_to_next: candidate.transport_to_next || 'Local transfer'
    };
  }

  return {
    type: 'spot',
    name: `${destinationName} orientation walk`,
    address: destinationName,
    duration: '2-3h',
    description: 'A relaxed first-stop suggestion to help shape the day route.',
    transport_to_next: 'Arrange a short local transfer'
  };
}

function normalizeFood(candidate, destinationName) {
  if (candidate) {
    return {
      type: 'food',
      name: candidate.name || `${destinationName} local meal`,
      address: candidate.address || destinationName,
      budget: candidate.budget || '',
      recommend: candidate.recommend || 'Regional signature dishes'
    };
  }

  return {
    type: 'food',
    name: `${destinationName} local meal`,
    address: destinationName,
    budget: 'Flexible',
    recommend: 'Choose a well-reviewed local restaurant nearby'
  };
}

function normalizeHotel(candidate, destinationName) {
  if (candidate) {
    return {
      type: 'hotel',
      name: candidate.name || `${destinationName} stay`,
      address: candidate.address || destinationName,
      budget: candidate.budget || '',
      reason: candidate.reason || 'Selected from currently available stay options'
    };
  }

  return {
    type: 'hotel',
    name: `${destinationName} stay`,
    address: destinationName,
    budget: 'To confirm',
    reason: 'A centrally placed stay can keep the day easy to manage'
  };
}

export class TripSkeletonBuilder {
  build(request, candidates = {}) {
    const spots = Array.isArray(candidates.spots) ? candidates.spots : [];
    const foods = Array.isArray(candidates.foods) ? candidates.foods : [];
    const hotels = Array.isArray(candidates.hotels) ? candidates.hotels : [];
    const warnings = [];

    if (candidates.coverage?.level === 'weak') {
      warnings.push('limited_poi_coverage');
    }

    const itinerary = Array.from({ length: request.days }, (_, index) => {
      const dayNumber = index + 1;
      const destinationName = getDestinationName(request, index);

      return {
        day: dayNumber,
        date: formatDay(request.start_date, index),
        items: [
          normalizeSpot(spots[index % Math.max(spots.length, 1)] || null, destinationName, dayNumber),
          normalizeFood(foods[index % Math.max(foods.length, 1)] || null, destinationName),
          normalizeHotel(hotels[index % Math.max(hotels.length, 1)] || null, destinationName)
        ]
      };
    });

    return { itinerary, warnings };
  }
}
