// 用户行为分析路由
import { analyticsService } from '../services/analyticsService.js';
import { ok } from '../utils/response.js';

function fail(code, message) { return { code, message }; }

export default async function analyticsRoutes(fastify) {
  // 记录单个事件
  fastify.post('/event', async (req) => {
    const { event_type, target_type, target_id, payload } = req.body || {};

    if (!event_type) {
      return fail(20001, '缺少 event_type 参数');
    }

    // 从请求头获取 openid（前端通过 services/api.js 自动附带）
    const openid = req.headers['x-openid'] || '';

    const result = await analyticsService.track({ openid, event_type, target_type, target_id, payload });

    // 埋点始终不阻断主流程，返回固定成功
    return ok({ tracked: true });
  });

  // 批量记录事件
  fastify.post('/events', async (req) => {
    const { events } = req.body || {};
    if (!Array.isArray(events) || events.length === 0) {
      return ok({ tracked: 0 });
    }

    const openid = req.headers['x-openid'] || '';
    const enriched = events.map(e => ({ ...e, openid }));

    await analyticsService.trackBatch(enriched);
    return ok({ tracked: events.length });
  });
}
