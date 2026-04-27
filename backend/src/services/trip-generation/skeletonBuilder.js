function getDestinationName(request, index) {
  const destination = request.destinations[index % request.destinations.length];
  return typeof destination === 'string' ? destination : destination?.name || '目的地';
}

function hasEnglishNarrative(value) {
  return typeof value === 'string' && /[A-Za-z]{2,}/.test(value);
}

function useChineseNarrative(value, fallback) {
  return value && !hasEnglishNarrative(value) ? value : fallback;
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
      name: candidate.name || `${destinationName}精选景点`,
      address: candidate.address || destinationName,
      duration: candidate.duration || '2-3h',
      description: useChineseNarrative(candidate.description, `第${dayNumber}天优先安排的核心游玩点，适合作为当天路线的主轴。`),
      transport_to_next: useChineseNarrative(candidate.transport_to_next, '建议结合当天位置安排就近交通')
    };
  }

  return {
    type: 'spot',
    name: `${destinationName}轻游路线`,
    address: destinationName,
    duration: '2-3h',
    description: '先安排一段轻松的城市漫游，帮助你熟悉目的地节奏。',
    transport_to_next: '建议安排短途本地交通衔接下一站'
  };
}

function normalizeFood(candidate, destinationName) {
  if (candidate) {
    return {
      type: 'food',
      name: candidate.name || `${destinationName}本地餐食`,
      address: candidate.address || destinationName,
      budget: candidate.budget || '',
      recommend: useChineseNarrative(candidate.recommend, '优先选择当地口碑菜品，适合放在当天路线附近用餐')
    };
  }

  return {
    type: 'food',
    name: `${destinationName}本地餐食`,
    address: destinationName,
    budget: '按实际消费确认',
    recommend: '建议选择路线附近评价稳定的本地餐厅'
  };
}

function normalizeHotel(candidate, destinationName) {
  if (candidate) {
    return {
      type: 'hotel',
      name: candidate.name || `${destinationName}住宿`,
      address: candidate.address || destinationName,
      budget: candidate.budget || '',
      reason: useChineseNarrative(candidate.reason, '结合当前可用住宿信息，优先选择交通相对方便的位置')
    };
  }

  return {
    type: 'hotel',
    name: `${destinationName}住宿建议`,
    address: destinationName,
    budget: '待确认',
    reason: '建议选择靠近主要活动区域的住宿，方便控制每天通勤时间'
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
