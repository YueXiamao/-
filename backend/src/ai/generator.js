// AI 生成器
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

// 根据配置选择 AI Provider
async function callAI(prompt, systemPrompt) {
  if (config.ai.provider === 'claude') {
    return callClaude(prompt, systemPrompt);
  } else if (config.ai.provider === 'openai') {
    return callOpenAI(prompt, systemPrompt);
  } else {
    throw AppError.AI_ERROR('未配置的 AI Provider: ' + config.ai.provider);
  }
}

// Claude API 调用
async function callClaude(prompt, systemPrompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: config.ai.apiKey });

  const response = await client.messages.create({
    model: config.ai.model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

// OpenAI API 调用
async function callOpenAI(prompt, systemPrompt) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// 行程生成 Prompt
const TRIP_SYSTEM_PROMPT = `你是一名资深旅游规划师，拥有丰富的中国旅游知识。你根据用户的需求，生成贴心、实用、不流水账的旅游行程。

要求：
1. 只推荐真实存在、口碑好的地方，不输出广告
2. 每天2-4个景点、1-2家餐厅、1家酒店
3. 景点之间给出交通提示（步行X分钟/打车X分钟）
4. 每个景点给出游览时长
5. 餐厅给出推荐菜和人均消费
6. 住宿给出推荐理由
7. 总字数精简，每日报程控制在300字以内
8. 输出纯JSON数组，不要markdown代码块`;

function buildTripPrompt({ destinations, start_date, days, preferences, extra_notes, pois }) {
  const destNames = destinations.map(d => typeof d === 'string' ? d : d.name).join('、');

  const poiText = `
景点POI：
${pois.spots.map(s => `- ${s.name} (${s.address}) 评分:${s.rating || '无'} 标签:${s.tag || '无'}`).join('\n')}

餐厅POI：
${pois.foods.map(f => `- ${f.name} (${f.address}) 人均:${f.price ? f.price + '元' : '无'}`).join('\n')}

酒店POI：
${pois.hotels.map(h => `- ${h.name} (${h.address})`).join('\n')}
`;

  const prompt = `目的地：${destNames}
出发日期：${start_date}
游玩天数：${days}天
游玩方式：${preferences.join('、')}
补充说明：${extra_notes || '无'}

可用POI数据：
${poiText}

按日期生成${days}天的行程计划。返回JSON数组，格式如下：
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

  return prompt;
}

// 目的地推荐 Prompt
const RECOMMEND_SYSTEM_PROMPT = `你是一名熟悉中国旅游的行程规划师，根据用户的位置、预算、天数和偏好，推荐最合适的旅游目的地。`;

function buildRecommendPrompt({ current_location, days, budget, preferences }) {
  const { latitude, longitude, city } = current_location;

  return `当前位置：${city || `${latitude},${longitude}`}
出行天数：${days}天
人均预算：${budget}
偏好方式：${preferences?.join('、') || '无'}

从候选目的地池中选择最符合条件的前3个，输出JSON：
{
  "recommendations": [
    {
      "rank": 1,
      "destination": {
        "name": "目的地图",
        "province": "省份",
        "city": "城市",
        "distance": "XXkm",
        "avg_budget": "参考消费",
        "tags": ["标签1", "标签2"],
        "summary": "一句话推荐理由"
      },
      "trip_preview": {
        "days": 适合天数,
        "spot_count": 预计景点数,
        "food_count": 预计餐饮数,
        "budget_range": "预算区间"
      }
    }
  ]
}`;
}

// 解析 JSON（容错）
function parseJSON(text) {
  // 去掉可能的 ```json 和 ``` 包裹
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 尝试提取数组
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        throw AppError.AI_ERROR('AI返回格式解析失败');
      }
    }
    throw AppError.AI_ERROR('AI返回格式解析失败');
  }
}

// 生成行程
async function generateTrip(params) {
  const { destinations, start_date, days, preferences, extra_notes, pois } = params;

  const prompt = buildTripPrompt({ destinations, start_date, days, preferences, extra_notes, pois });
  const text = await callAI(prompt, TRIP_SYSTEM_PROMPT);

  let itinerary;
  try {
    itinerary = parseJSON(text);
  } catch (err) {
    throw AppError.AI_ERROR('行程解析失败: ' + err.message);
  }

  // 填充日期
  const startDateObj = new Date(start_date);
  itinerary = itinerary.map((day, index) => {
    const date = new Date(startDateObj);
    date.setDate(date.getDate() + index);
    return {
      ...day,
      date: date.toISOString().split('T')[0]
    };
  });

  return itinerary;
}

// 生成推荐
async function generateRecommendations(params) {
  const prompt = buildRecommendPrompt(params);
  const text = await callAI(prompt, RECOMMEND_SYSTEM_PROMPT);

  try {
    return parseJSON(text);
  } catch (err) {
    throw AppError.AI_ERROR('推荐解析失败: ' + err.message);
  }
}

export const aiGenerator = {
  generateTrip,
  generateRecommendations,
  callAI,
  parseJSON
};
