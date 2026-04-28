// AI 生成器 - 支持 MiniMax (OpenAI 兼容格式)
import { config } from '../config/index.js';
import { AppError, Errors } from '../middleware/errorHandler.js';

const TRIP_SYSTEM = `你是一名资深中国旅游规划师。只推荐真实存在、口碑好的景点、餐厅和酒店，不输出任何广告或推广内容。

输出规范：
1. 只推荐真实存在、有具体名称和地址的地方
2. 每天3-5个景点（上午1-2个 + 下午1-2个）、2家餐厅（午餐+晚餐）、1家住宿
3. 每个景点必须包含：名称、地址、游览时长（X小时）、游览建议（游玩路线/拍照点/避坑提示）、最佳游览时间、门票信息
4. 餐厅必须包含：名称、地址、人均消费、推荐菜2-3道、订座提示（如需）
5. 住宿必须包含：名称、地址、价位区间、入住贴士（停车/入住时间/周边环境）
6. 景点之间必须给出交通衔接说明（步行X分钟 / 打车X元）
7. 每项 item 的 recommend / reason / tips / description 字段必须中文、详细、具体，禁止空洞套话
8. 输出纯JSON，不要任何markdown格式`;

const TRIP_USER_TEMPLATE = `目的地：{{destNames}}
出发日期：{{start_date}}
游玩天数：{{days}}天
游玩方式：{{preferences}}
补充说明：{{extra_notes}}

可用POI候选（可参考，也可按需增补真实景点）：
{{poiText}}

请按日期生成{{days}}天详细行程，返回纯JSON数组：
[
  {
    "day": 1,
    "date": "YYYY-MM-DD",
    "summary": "X月X日 · 目的地 · N项安排（上午/下午/住宿）",
    "items": [
      {"type": "spot", "period": "morning", "period_label": "上午", "name": "景点名", "address": "地址", "duration": "2-3小时", "best_time": "9:00-12:00", "ticket_info": "门票信息/免费", "description": "游览路线建议和看点描述", "reason": "为什么推荐这个景点", "tips": "拍照点/避坑/注意事项", "transport_to_next": "步行8分钟或打车15元"},
      {"type": "food", "period": "lunch", "period_label": "午餐", "name": "餐厅名", "address": "地址", "budget": "人均60元", "cuisine_type": "川菜/火锅等", "recommend": "招牌菜1、招牌菜2、招牌菜3", "reservation_tips": "建议提前预约/无需预约", "reason": "为什么适合当天午餐"},
      {"type": "spot", "period": "afternoon", "period_label": "下午", "name": "景点名", "address": "地址", "duration": "2-3小时", "best_time": "14:00-17:00", "ticket_info": "门票信息/免费", "description": "游览路线建议和看点描述", "reason": "为什么放在下午", "tips": "拍照点/避坑/注意事项", "transport_to_next": "步行5分钟"},
      {"type": "food", "period": "dinner", "period_label": "晚餐", "name": "餐厅名", "address": "地址", "budget": "人均80元", "cuisine_type": "本地菜", "recommend": "招牌菜1、招牌菜2、招牌菜3", "reservation_tips": "建议提前预约", "reason": "为什么适合当天晚餐"},
      {"type": "hotel", "period": "night", "period_label": "住宿", "name": "酒店名", "address": "地址", "budget": "300-500元/晚", "highlights": "评分4.5/近景区/含早", "check_in_tips": "建议18:00前入住/免费停车", "reason": "为什么推荐这家住宿"}
    ]
  }
]`;

const RECOMMEND_SYSTEM = `你是一名熟悉中国旅游的行程规划师，根据用户的位置、预算、天数和偏好，推荐最合适的旅游目的地。只推荐国内目的地。`;

const ENHANCE_SYSTEM = `你是一名谨慎的中文旅行行程文案编辑。只优化已有行程中的中文展示文案字段，不改变天数、日期、顺序、类型、名称、地址和目的地。description、recommend、reason、transport_to_next、notes 必须使用中文；只有真实店名或地名本身是英文时，name 和 address 可以保留英文。只返回纯 JSON。`;

const ALLOWED_ENHANCEMENT_FIELDS = [
  'description',
  'recommend',
  'reason',
  'duration',
  'budget',
  'transport_to_next',
  'notes',
  // 新增详细字段
  'best_time',
  'ticket_info',
  'tips',
  'period',
  'period_label',
  'cuisine_type',
  'reservation_tips',
  'highlights',
  'check_in_tips',
  'summary',
  'date_display',
];

function buildTripPrompt({ destinations, start_date, days, preferences, extra_notes, pois }) {
  const destNames = destinations.map(d => typeof d === 'string' ? d : d.name).join('、');

  const poiText = `景点候选：${pois.spots.map(s => `- ${s.name}(${s.address || '地址不详'}) 评分:${s.rating || '无'} 游览时长:${s.duration || '待估算'} 标签:${(s.tags || []).slice(0, 3).join('/')}`).join('\n')}
餐厅候选：${pois.foods.map(f => `- ${f.name}(${f.address || '地址不详'}) 人均:${f.price ? f.price + '元' : '待查'} 菜系:${(f.tags || [])[0] || '本地菜'}`).join('\n')}
酒店候选：${pois.hotels.map(h => `- ${h.name}(${h.address || '地址不详'}) 价格:${h.price ? h.price + '元/晚' : '待查'} 评分:${h.rating || '待查'}`).join('\n')}`;

  return `目的地：${destNames}
出发日期：${start_date}
游玩天数：${days}天
游玩方式：${(preferences || []).join('、')}
补充：${extra_notes || '无'}

可用POI候选（可直接引用，也可按需增补真实景点）：
${poiText}

请按日期生成${days}天详细行程，返回纯JSON数组：
[
  {
    "day": 1,
    "date": "YYYY-MM-DD",
    "summary": "X月X日 · 目的地 · N项安排",
    "items": [
      {"type": "spot", "period": "morning", "period_label": "上午", "name": "景点名", "address": "地址", "duration": "2-3小时", "best_time": "9:00-12:00", "ticket_info": "门票信息/免费", "description": "游览路线建议和看点描述", "reason": "为什么推荐这个景点", "tips": "拍照点/避坑/注意事项", "transport_to_next": "步行8分钟"},
      {"type": "food", "period": "lunch", "period_label": "午餐", "name": "餐厅名", "address": "地址", "budget": "人均60元", "cuisine_type": "川菜", "recommend": "招牌菜1、招牌菜2、招牌菜3", "reservation_tips": "建议提前预约", "reason": "为什么适合当天午餐"},
      {"type": "spot", "period": "afternoon", "period_label": "下午", "name": "景点名", "address": "地址", "duration": "2-3小时", "best_time": "14:00-17:00", "ticket_info": "门票信息/免费", "description": "游览路线建议和看点描述", "reason": "为什么放在下午", "tips": "拍照点/避坑/注意事项", "transport_to_next": "步行5分钟"},
      {"type": "food", "period": "dinner", "period_label": "晚餐", "name": "餐厅名", "address": "地址", "budget": "人均80元", "cuisine_type": "本地菜", "recommend": "招牌菜1、招牌菜2", "reservation_tips": "建议提前预约", "reason": "为什么适合当天晚餐"},
      {"type": "hotel", "period": "night", "period_label": "住宿", "name": "酒店名", "address": "地址", "budget": "300-500元/晚", "highlights": "近景区/含早", "check_in_tips": "建议18:00前入住", "reason": "为什么推荐这家住宿"}
    ]
  }
]`;
}

function buildRecommendPrompt({ current_location, days, budget, preferences }) {
  const { latitude, longitude, city } = current_location;
  return `当前位置：${city || `${latitude && longitude ? latitude + ',' + longitude : '未知'}`}
出行天数：${days}天
人均预算：${budget}
偏好：${(preferences || []).join('、') || '无'}

推荐3个最合适的目的地，输出JSON（不要markdown格式）：
{
  "recommendations": [
    {
      "rank": 1,
      "destination": {"name": "城市名", "province": "省份", "city": "城市", "distance": "XXkm或未知", "avg_budget": "参考消费", "tags": ["标签1"], "summary": "一句话推荐理由"},
      "trip_preview": {"days": 天数, "spot_count": 预计景点数, "food_count": 预计餐饮数, "budget_range": "预算区间"}
    }
  ]
}`;
}

function summarizeCandidates(candidates = {}) {
  const pick = (items = []) => items.slice(0, 12).map((item) => ({
    type: item.type || '',
    name: item.name || '',
    address: item.address || '',
    city: item.city || '',
    tags: item.tags || [],
    rating: item.rating || '',
    price: item.price || ''
  }));

  return {
    spots: pick(candidates.spots),
    foods: pick(candidates.foods),
    hotels: pick(candidates.hotels)
  };
}

function buildEnhancementPrompt({ request, skeleton, candidates }) {
  return JSON.stringify({
    task: '在不改变结构的前提下优化行程展示文案。只在有必要时优化 description、recommend、reason、duration、budget、transport_to_next 等字段。不要改变名称、地址、日期、天数、条目顺序或类型。解释性文案必须使用中文；只有真实店名或地名本身是英文时，name 和 address 可以保留英文。返回增强后的 itinerary 数组 JSON。',
    request: {
      destinations: request.destinations,
      start_date: request.start_date,
      days: request.days,
      preferences: request.preferences || [],
      extra_notes: request.extra_notes || ''
    },
    skeleton,
    candidates: summarizeCandidates(candidates)
  });
}

function getItinerary(result) {
  return Array.isArray(result) ? result : result?.itinerary;
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function copyAllowedField(target, source, fieldName) {
  if (Object.prototype.hasOwnProperty.call(target, fieldName)
    && hasNonEmptyString(source?.[fieldName])) {
    target[fieldName] = source[fieldName];
  }
}

function hasBaselineValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function assertSameValue(actual, expected) {
  return !hasBaselineValue(expected) || actual === expected;
}

function assertPreservedDescriptiveFields(aiContainer, baselineContainer, fieldNames) {
  for (const fieldName of fieldNames) {
    if (hasNonEmptyString(baselineContainer?.[fieldName])
      && !hasNonEmptyString(aiContainer?.[fieldName])) {
      throw new Error('AI enhancement omitted baseline descriptive fields');
    }
  }
}

export function validateRawEnhancedItinerary(skeleton, aiResult) {
  const skeletonItinerary = getItinerary(skeleton);
  const aiItinerary = getItinerary(aiResult);

  if (!Array.isArray(skeletonItinerary) || !Array.isArray(aiItinerary)) {
    throw new Error('AI enhancement changed itinerary structure');
  }

  if (aiItinerary.length !== skeletonItinerary.length) {
    throw new Error('AI enhancement changed itinerary structure');
  }

  skeletonItinerary.forEach((skeletonDay, dayIndex) => {
    const aiDay = aiItinerary[dayIndex];

    if (!aiDay || typeof aiDay !== 'object') {
      throw new Error('AI enhancement changed itinerary structure');
    }

    if (!assertSameValue(aiDay.day, skeletonDay.day)
      || !assertSameValue(aiDay.day_number, skeletonDay.day_number)
      || !assertSameValue(aiDay.date, skeletonDay.date)) {
      throw new Error('AI enhancement changed itinerary structure');
    }

    assertPreservedDescriptiveFields(aiDay, skeletonDay, ['summary']);

    if (!Array.isArray(skeletonDay.items)
      || !Array.isArray(aiDay.items)
      || aiDay.items.length !== skeletonDay.items.length) {
      throw new Error('AI enhancement changed itinerary structure');
    }

    skeletonDay.items.forEach((skeletonItem, itemIndex) => {
      const aiItem = aiDay.items[itemIndex];

      if (!aiItem || typeof aiItem !== 'object') {
        throw new Error('AI enhancement changed itinerary structure');
      }

      if (!assertSameValue(aiItem.type, skeletonItem.type)
        || !assertSameValue(aiItem.name, skeletonItem.name)
        || !assertSameValue(aiItem.address, skeletonItem.address)) {
        throw new Error('AI enhancement changed itinerary structure');
      }

      assertPreservedDescriptiveFields(aiItem, skeletonItem, ALLOWED_ENHANCEMENT_FIELDS);
    });
  });
}

export function mergeEnhancedItinerary(skeleton, aiResult) {
  const skeletonItinerary = getItinerary(skeleton);
  const aiItinerary = getItinerary(aiResult);

  validateRawEnhancedItinerary(skeletonItinerary, aiItinerary);

  if (!Array.isArray(skeletonItinerary)) {
    return [];
  }

  return skeletonItinerary.map((skeletonDay, dayIndex) => {
    const aiDay = Array.isArray(aiItinerary) && aiItinerary[dayIndex]
      && typeof aiItinerary[dayIndex] === 'object'
      ? aiItinerary[dayIndex]
      : null;
    const mergedDay = {
      ...skeletonDay,
      items: Array.isArray(skeletonDay.items)
        ? skeletonDay.items.map((skeletonItem, itemIndex) => {
          const aiItem = Array.isArray(aiDay?.items) && aiDay.items[itemIndex]
            && typeof aiDay.items[itemIndex] === 'object'
            ? aiDay.items[itemIndex]
            : null;
          const mergedItem = { ...skeletonItem };

          for (const fieldName of ALLOWED_ENHANCEMENT_FIELDS) {
            copyAllowedField(mergedItem, aiItem, fieldName);
          }

          return mergedItem;
        })
        : []
    };

    copyAllowedField(mergedDay, aiDay, 'summary');

    return mergedDay;
  });
}

function parseJSON(text) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch {}
    }

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw Errors.AI_ERROR('AI返回格式解析失败');
  }
}

async function callMiniMax(prompt, systemPrompt) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: config.ai.apiKey,
    baseURL: config.ai.baseUrl
  });

  const response = await client.chat.completions.create({
    model: config.ai.model,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  });

  return response.choices[0].message.content;
}

async function generateTrip(params) {
  const prompt = buildTripPrompt(params);
  let text;
  try {
    text = await callMiniMax(prompt, TRIP_SYSTEM);
  } catch (err) {
    console.error('MiniMax 调用失败:', err.message);
    throw Errors.AI_ERROR('AI服务调用失败: ' + err.message);
  }

  let itinerary;
  try {
    itinerary = parseJSON(text);
  } catch (err) {
    console.error('AI 输出:', text.slice(0, 200));
    throw Errors.AI_ERROR('行程解析失败: ' + err.message);
  }

  const startObj = new Date(params.start_date);
  itinerary = itinerary.map((day, i) => {
    const d = new Date(startObj);
    d.setDate(d.getDate() + i);
    return { ...day, date: d.toISOString().split('T')[0] };
  });

  return itinerary;
}

async function generateRecommendations(params) {
  const prompt = buildRecommendPrompt(params);
  let text;
  try {
    text = await callMiniMax(prompt, RECOMMEND_SYSTEM);
  } catch (err) {
    throw Errors.AI_ERROR('AI服务调用失败: ' + err.message);
  }

  try {
    return parseJSON(text);
  } catch (err) {
    console.error('AI 输出:', text.slice(0, 200));
    throw Errors.AI_ERROR('推荐解析失败: ' + err.message);
  }
}

async function enhanceTripSkeleton(params) {
  const prompt = buildEnhancementPrompt(params);
  let text;

  try {
    text = await callMiniMax(prompt, ENHANCE_SYSTEM);
  } catch (err) {
    throw Errors.AI_ERROR('AI enhancement call failed');
  }

  try {
    const parsed = parseJSON(text);
    const itinerary = mergeEnhancedItinerary(params.skeleton, parsed);

    if (!Array.isArray(itinerary)) {
      throw new AppError('AI enhancement did not return an itinerary', 500, 20001);
    }

    return itinerary;
  } catch (err) {
    throw Errors.AI_ERROR('AI enhancement parse failed');
  }
}

export const aiGenerator = { generateTrip, generateRecommendations, enhanceTripSkeleton };
