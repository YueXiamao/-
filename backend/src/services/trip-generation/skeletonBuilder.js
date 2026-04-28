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

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  return `${parseInt(m)}月${parseInt(d)}日`;
}

// 提取POI已有信息，填充到骨架字段
function enrichSpot(candidate, destinationName, dayNumber) {
  const base = {
    type: 'spot',
    name: candidate?.name || `${destinationName}核心景点`,
    address: candidate?.address || destinationName,
    duration: candidate?.duration || '2-3小时',
    description: candidate?.description || '',
    reason: candidate?.reason || `第${dayNumber}天的主要游览目标，知名度高、游玩价值突出`,
    best_time: candidate?.best_time || '',
    tips: candidate?.tips || '',
    ticket_info: candidate?.ticket_info || '',
    transport_to_next: candidate?.transport_to_next || '步行5-10分钟即可到达附近餐饮',
  };

  // 如果POI有评分/标签，注入reason
  if (candidate?.rating && !base.reason.includes('评分')) {
    base.reason = `第${dayNumber}天游玩首选，评分${candidate.rating}分，口碑稳定，适合作为当日游览主轴。`;
  }

  // 注入游览要点提示
  if (candidate?.tags?.length) {
    const tagList = candidate.tags.slice(0, 3).join('、');
    base.tips = `关键词：${tagList}。${base.tips}`;
  }

  return base;
}

function enrichFood(candidate, destinationName) {
  const base = {
    type: 'food',
    name: candidate?.name || `${destinationName}本地餐食`,
    address: candidate?.address || destinationName,
    budget: candidate?.budget || '',
    recommend: candidate?.recommend || '',
    reason: candidate?.reason || '当地口碑餐厅，适合安排在当日游览路线附近用餐',
    cuisine_type: candidate?.cuisine_type || '',
    reservation_tips: candidate?.reservation_tips || '',
  };

  if (candidate?.price) {
    base.budget = `人均约${candidate.price}元`;
    base.reason = `位于${destinationName}，人均${candidate.price}元，性价比不错，契合当日行程安排。`;
  }

  if (candidate?.tags?.length) {
    const cuisine = candidate.tags[0] || '';
    if (cuisine) base.cuisine_type = cuisine;
  }

  return base;
}

function enrichHotel(candidate, destinationName) {
  const base = {
    type: 'hotel',
    name: candidate?.name || `${destinationName}住宿`,
    address: candidate?.address || destinationName,
    budget: candidate?.budget || '',
    reason: candidate?.reason || '',
    check_in_tips: candidate?.check_in_tips || '',
    highlights: candidate?.highlights || '',
  };

  if (candidate?.price) {
    base.budget = `${candidate.price}元/晚`;
    base.reason = `位于${destinationName}，价格${candidate.price}元/晚，位置便利，次日出行方便。`;
  }

  if (candidate?.rating) {
    base.highlights = `评分${candidate.rating}`;
  }

  return base;
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

    // 每天安排：上午景点 + 午间美食 + 下午/傍晚景点 + 晚餐 + 住宿
    // 每天2个景点(上午+下午) + 2家餐厅(午餐+晚餐) + 1家酒店
    const itinerary = Array.from({ length: request.days }, (_, index) => {
      const dayNumber = index + 1;
      const destinationName = getDestinationName(request, index);
      const date = formatDay(request.start_date, index);
      const dateDisplay = formatDateDisplay(date);

      const morningSpot = spots[(index * 2) % Math.max(spots.length, 1)];
      const afternoonSpot = spots[(index * 2 + 1) % Math.max(spots.length, 1)];
      const lunchFood = foods[(index * 2) % Math.max(foods.length, 1)];
      const dinnerFood = foods[(index * 2 + 1) % Math.max(foods.length, 1)];
      const hotel = hotels[index % Math.max(hotels.length, 1)];

      const items = [];

      // 上午景点（必有）
      if (morningSpot) {
        items.push({
          ...enrichSpot(morningSpot, destinationName, dayNumber),
          period: 'morning',
          period_label: '上午',
        });
      }

      // 午餐（必有）
      if (lunchFood) {
        items.push({
          ...enrichFood(lunchFood, destinationName),
          period: 'lunch',
          period_label: '午餐',
        });
      }

      // 下午景点（尽量有，超过3天行程时第二天下午安排）
      if (afternoonSpot && index < request.days - 1) {
        items.push({
          ...enrichSpot(afternoonSpot, destinationName, dayNumber),
          period: 'afternoon',
          period_label: '下午',
        });
      } else if (afternoonSpot) {
        // 最后一天下午改为自由活动
        items.push({
          type: 'spot',
          name: `${destinationName}自由活动/返程准备`,
          address: destinationName,
          duration: '2-3小时',
          description: '最后一天下午以轻松活动为主，可根据返程时间灵活安排。',
          reason: '行程尾声，轻松收尾，留出充足时间准备返程。',
          tips: '建议提前确认返程交通，预留足够时间。',
          period: 'afternoon',
          period_label: '下午',
        });
      }

      // 晚餐（必有，超过1天的行程才有）
      if (request.days > 1 && dinnerFood) {
        items.push({
          ...enrichFood(dinnerFood, destinationName),
          period: 'dinner',
          period_label: '晚餐',
        });
      }

      // 住宿（第一天和倒数第二天晚上安排，中间可跳过）
      if (hotel && (index === 0 || index === request.days - 2)) {
        items.push({
          ...enrichHotel(hotel, destinationName),
          period: 'night',
          period_label: '住宿',
        });
      } else if (index === request.days - 1) {
        // 最后一晚住宿（若有）
        const lastHotel = hotels[(request.days - 1) % Math.max(hotels.length, 1)];
        if (lastHotel) {
          items.push({
            ...enrichHotel(lastHotel, destinationName),
            period: 'night',
            period_label: '住宿',
          });
        }
      }

      return {
        day: dayNumber,
        date,
        date_display: dateDisplay,
        summary: `${dateDisplay} · ${destinationName} · ${items.length}项安排`,
        items,
      };
    });

    return { itinerary, warnings };
  }
}
