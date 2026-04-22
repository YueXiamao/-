// AI 生成器 - 支持 MiniMax (OpenAI 兼容格式)
import { config } from '../config/index.js';
import { AppError, Errors } from '../middleware/errorHandler.js';

const TRIP_SYSTEM = `你是一名资深中国旅游规划师。只推荐真实存在、口碑好的景点、餐厅和酒店，不输出任何广告或推广内容。

要求：
1. 只推荐真实存在、有具体名称和地址的地方
2. 每天2-4个景点、1-2家餐厅、1家酒店
3. 景点之间给出交通提示（步行X分钟/打车X分钟）和游览时长
4. 餐厅给出推荐菜和人均消费
5. 住宿给出推荐理由
6. 总字数精简，每日报程控制在300字以内
7. 输出纯JSON，不要任何markdown格式`;

const RECOMMEND_SYSTEM = `你是一名熟悉中国旅游的行程规划师，根据用户的位置、预算、天数和偏好，推荐最合适的旅游目的地。只推荐国内目的地。`;

function buildTripPrompt({ destinations, start_date, days, preferences, extra_notes, pois }) {
  const destNames = destinations.map(d => typeof d === 'string' ? d : d.name).join('、');

  const poiText = `景点：${pois.spots.map(s => `- ${s.name}(${s.address}) 评分:${s.rating || '无'}`).join('\n')}
餐厅：${pois.foods.map(f => `- ${f.name}(${f.address}) 人均:${f.price ? f.price + '元' : '无'}`).join('\n')}
酒店：${pois.hotels.map(h => `- ${h.name}(${h.address})`).join('\n')}`;

  return `目的地：${destNames}
出发日期：${start_date}
游玩天数：${days}天
游玩方式：${(preferences || []).join('、')}
补充：${extra_notes || '无'}

可用POI：
${poiText}

按日期生成${days}天行程，返回JSON数组（不要markdown格式）：
[
  {
    "day": 1,
    "date": "YYYY-MM-DD",
    "items": [
      {"type": "spot", "name": "景点名", "address": "地址", "duration": "1-2小时", "description": "一句话描述", "transport_to_next": "步行5分钟"},
      {"type": "food", "name": "餐厅名", "address": "地址", "budget": "人均X元", "recommend": "推荐菜1、推荐菜2"},
      {"type": "hotel", "name": "酒店名", "address": "地址", "budget": "X-Y元/晚", "reason": "推荐理由"}
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

function parseJSON(text) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
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
    baseURL: config.ai.baseUrl || 'https://api.minimax.chat/v'
  });

  const response = await client.chat.completions.create({
    model: config.ai.model || 'abab6.5s-chat',
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

export const aiGenerator = { generateTrip, generateRecommendations };
