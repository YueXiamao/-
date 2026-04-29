// ─── 工具函数 ────────────────────────────────────────────────────────────────

function getDestinationName(request, index) {
  const destination = request.destinations[index % request.destinations.length];
  return typeof destination === 'string' ? destination : destination?.name || '目的地';
}

function hasEnglishNarrative(value) {
  return typeof value === 'string' && /[A-Za-z]{2,}/.test(value);
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── 可信字段注入 ───────────────────────────────────────────────────────────

/**
 * 判断单个字段的可信等级
 * 有真实数据（来源明确，非默认值）→ verified
 * 使用规则估算的默认值 → estimated
 */
function fieldConfidence(candidate, field, defaultValue) {
  const real = candidate?.[field];
  if (real !== undefined && real !== null && real !== '' && real !== defaultValue) {
    return 'verified';
  }
  return 'estimated';
}

/**
 * 统一的可信字段注入
 * @param {object} base - 原始 POI 数据（来自高德/数据库）
 * @param {object} defaults - 各字段的默认值（用于判断是否使用了默认值）
 */
function addConfidenceFields(base, defaults = {}) {
  const hasRating = base?.rating != null;
  const hasReviewCount = base?.review_count != null && base.review_count > 0;
  const hasOpenTime = base?.open_time && base.open_time !== '未知' && base.open_time !== '';
  const hasTicketInfo = base?.ticket_info && base.ticket_info !== '未知' && base.ticket_info !== '';

  return {
    // 数据来源
    source: base?.source || 'amap',
    // 可信等级：rating存在→verified，否则→estimated（骨架默认项均为估算）
    confidence_level: hasRating ? 'verified' : 'estimated',
    // 最后验证时间
    last_verified_at: base?.last_verified_at || today(),
    // 评分（有真实数据才展示，不伪造）
    ...(hasRating ? { rating: base.rating } : {}),
    // 评论数
    ...(hasReviewCount ? { review_count: base.review_count } : {}),
    // 营业时间
    ...(hasOpenTime ? { open_time: base.open_time } : {}),
    // 门票信息
    ...(hasTicketInfo ? { ticket_info: base.ticket_info } : {}),
  };
}

// ─── POI enrichment ─────────────────────────────────────────────────────────

function enrichSpot(candidate, destinationName, dayNumber) {
  const defaults = { duration: '2-3小时' };
  const base = {
    type: 'spot',
    name: candidate?.name || `${destinationName}核心景点`,
    address: candidate?.address || destinationName,
    duration: candidate?.duration || defaults.duration,
    description: candidate?.description || '',
    reason: candidate?.reason || `第${dayNumber}天的主要游览目标，知名度高、游玩价值突出`,
    best_time: candidate?.best_time || '',
    tips: candidate?.tips || '',
    ticket_info: candidate?.ticket_info || '',
    transport_to_next: candidate?.transport_to_next || '步行5-10分钟即可到达附近餐饮',
  };

  // 有评分时注入更有信息量的 reason
  if (candidate?.rating && !base.reason.includes('评分')) {
    base.reason = `第${dayNumber}天游玩首选，评分${candidate.rating}分，口碑稳定，适合作为当日游览主轴。`;
  }

  // 注入游览要点提示
  if (candidate?.tags?.length) {
    const tagList = candidate.tags.slice(0, 3).join('、');
    base.tips = `关键词：${tagList}。${base.tips}`;
  }

  return { ...base, ...addConfidenceFields(candidate, defaults) };
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

  return { ...base, ...addConfidenceFields(candidate) };
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

  return { ...base, ...addConfidenceFields(candidate) };
}

function buildReferenceLinks(keyword, destinationName) {
  const query = encodeURIComponent(`${destinationName} ${keyword} 攻略`);
  const mapQuery = encodeURIComponent(keyword);
  const city = encodeURIComponent(destinationName);

  return [
    {
      label: '小红书参考',
      url: `https://www.xiaohongshu.com/search_result?keyword=${query}`
    },
    {
      label: '高德地图搜索',
      url: `https://uri.amap.com/search?keyword=${mapQuery}&city=${city}`
    }
  ];
}

function itemName(item) {
  return String(item?.name || '').trim();
}

function buildAlternatives(candidates, usedNames, destinationName, type, count = 5) {
  const selected = [];

  for (const candidate of candidates) {
    const name = itemName(candidate);
    if (!name || usedNames.has(name)) continue;

    usedNames.add(name);
    const tags = Array.isArray(candidate.tags) ? candidate.tags.slice(0, 3) : [];
    selected.push({
      type,
      name,
      address: candidate.address || destinationName,
      reason: candidate.rating
        ? `评分${candidate.rating}，适合作为主线之外的备选。`
        : '可作为主线之外的弹性选择，适合按当天体力和天气替换。',
      tags,
      budget: candidate.price ? `人均约${candidate.price}元` : '',
      reference_links: buildReferenceLinks(name, destinationName),
      source: candidate.source || 'amap',
      confidence_level: candidate.rating ? 'verified' : 'estimated',
      ...(candidate.rating ? { rating: candidate.rating } : {})
    });

    if (selected.length >= count) break;
  }

  return selected;
}

function attachReferenceLinks(item, destinationName) {
  return {
    ...item,
    reference_links: buildReferenceLinks(item.name, destinationName)
  };
}

// ─── 骨架构建器 ─────────────────────────────────────────────────────────────

export class TripSkeletonBuilder {
  /**
   * @param {object} request - 行程请求
   * @param {object} candidates - { spots, foods, hotels }
   * @returns {{ itinerary, warnings }}
   */
  build(request, candidates = {}) {
    const spots = Array.isArray(candidates.spots) ? candidates.spots : [];
    const foods = Array.isArray(candidates.foods) ? candidates.foods : [];
    const hotels = Array.isArray(candidates.hotels) ? candidates.hotels : [];
    const warnings = [];

    if (candidates.coverage?.level === 'weak') {
      warnings.push('limited_poi_coverage');
    }

    // 每天安排：上午景点 + 午间美食 + 下午/傍晚景点 + 晚餐 + 住宿
    const itinerary = Array.from({ length: request.days }, (_, index) => {
      const dayNumber = index + 1;
      const destinationName = getDestinationName(request, index);
      const date = formatDay(request.start_date, index);
      const dateDisplay = formatDateDisplay(date);

      // 有效 POI 才参与编排；空数组时安全地取 undefined（跳过但发警告）
      const morningSpot = spots.length > 0 ? spots[(index * 2) % spots.length] : null;
      const afternoonSpot = spots.length > 0 ? spots[(index * 2 + 1) % spots.length] : null;
      const lunchFood = foods.length > 0 ? foods[(index * 2) % foods.length] : null;
      const dinnerFood = foods.length > 0 ? foods[(index * 2 + 1) % foods.length] : null;
      const hotel = hotels.length > 0 ? hotels[index % hotels.length] : null;

      const items = [];
      const usedSpotNames = new Set([itemName(morningSpot), itemName(afternoonSpot)].filter(Boolean));
      const usedFoodNames = new Set([itemName(lunchFood), itemName(dinnerFood)].filter(Boolean));

      // 上午景点
      if (morningSpot) {
        items.push(attachReferenceLinks({ ...enrichSpot(morningSpot, destinationName, dayNumber), period: 'morning', period_label: '上午' }, destinationName));
      } else {
        items.push({
          type: 'spot', name: `${destinationName}推荐景点`, address: destinationName,
          duration: '2-3小时', description: '根据您的偏好推荐，具体景点待补充',
          reason: `第${dayNumber}天上午安排`, transport_to_next: '步行可达周边餐饮',
          period: 'morning', period_label: '上午',
          source: 'rule_based', confidence_level: 'estimated', last_verified_at: today(),
        });
      }

      // 午餐
      if (lunchFood) {
        items.push(attachReferenceLinks({ ...enrichFood(lunchFood, destinationName), period: 'lunch', period_label: '午餐' }, destinationName));
      } else {
        items.push({
          type: 'food', name: `${destinationName}推荐餐饮`, address: destinationName,
          budget: '', recommend: '根据您的偏好推荐', reason: '午间用餐安排',
          cuisine_type: '', reservation_tips: '',
          period: 'lunch', period_label: '午餐',
          source: 'rule_based', confidence_level: 'estimated', last_verified_at: today(),
        });
      }

      // 下午景点
      if (afternoonSpot && index < request.days - 1) {
        items.push(attachReferenceLinks({ ...enrichSpot(afternoonSpot, destinationName, dayNumber), period: 'afternoon', period_label: '下午' }, destinationName));
      } else if (index < request.days - 1) {
        // 无POI数据但不是最后一天
        items.push({
          type: 'spot', name: `${destinationName}推荐景点`, address: destinationName,
          duration: '2-3小时', description: '根据您的偏好推荐，具体景点待补充',
          reason: `第${dayNumber}天下午安排`, transport_to_next: '游览后返程',
          period: 'afternoon', period_label: '下午',
          source: 'rule_based', confidence_level: 'estimated', last_verified_at: today(),
        });
      } else {
        // 最后一天下午 → 自由活动
        items.push({
          type: 'spot', name: `${destinationName}自由活动/返程准备`, address: destinationName,
          duration: '2-3小时', description: '最后一天下午以轻松活动为主，可根据返程时间灵活安排。',
          reason: '行程尾声，轻松收尾，留出充足时间准备返程。',
          tips: '建议提前确认返程交通，预留足够时间。',
          period: 'afternoon', period_label: '下午',
          source: 'rule_based', confidence_level: 'estimated', last_verified_at: today(),
        });
      }

      // 晚餐（超过1天才有）
      if (request.days > 1) {
        if (dinnerFood) {
          items.push(attachReferenceLinks({ ...enrichFood(dinnerFood, destinationName), period: 'dinner', period_label: '晚餐' }, destinationName));
        } else {
          items.push({
            type: 'food', name: `${destinationName}推荐晚餐`, address: destinationName,
            budget: '', recommend: '根据您的偏好推荐', reason: '当日晚餐安排',
            cuisine_type: '', reservation_tips: '',
            period: 'dinner', period_label: '晚餐',
            source: 'rule_based', confidence_level: 'estimated', last_verified_at: today(),
          });
        }
      }

      // 住宿
      if (hotel && (index === 0 || index === request.days - 2)) {
        items.push(attachReferenceLinks({ ...enrichHotel(hotel, destinationName), period: 'night', period_label: '住宿' }, destinationName));
      } else if (index === request.days - 1) {
        const lastHotel = hotels.length > 0 ? hotels[(request.days - 1) % hotels.length] : null;
        if (lastHotel) {
          items.push(attachReferenceLinks({ ...enrichHotel(lastHotel, destinationName), period: 'night', period_label: '住宿' }, destinationName));
        } else {
          items.push({
            type: 'hotel', name: `${destinationName}推荐住宿`, address: destinationName,
            budget: '', reason: '当日住宿安排', check_in_tips: '建议提前预订',
            highlights: '',
            period: 'night', period_label: '住宿',
            source: 'rule_based', confidence_level: 'estimated', last_verified_at: today(),
          });
        }
      }

      const enrichedItems = items.map((item) => (
        Array.isArray(item.reference_links) ? item : attachReferenceLinks(item, destinationName)
      ));

      return {
        day: dayNumber,
        date,
        date_display: dateDisplay,
        summary: `${dateDisplay} · ${destinationName} · ${enrichedItems.length}项安排`,
        alternative_spots: buildAlternatives(spots, usedSpotNames, destinationName, 'spot', 6),
        alternative_foods: buildAlternatives(foods, usedFoodNames, destinationName, 'food', 6),
        reference_links: buildReferenceLinks(destinationName, destinationName),
        items: enrichedItems,
      };
    });

    return { itinerary, warnings };
  }
}
