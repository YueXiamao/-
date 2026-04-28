// 行为数据路由
import { analyticsService } from '../services/analyticsService.js';

// 统一响应格式
function ok(data) {
  return { code: 0, message: 'success', data };
}

function fail(code, message) {
  return { code, message };
}

export default async function analyticsRoutes(fastify) {
  // 接收前端埋点数据
  fastify.post('/event', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { events } = req.body || {};

    if (!events || !Array.isArray(events)) {
      return fail(30001, '缺少 events 参数');
    }

    if (events.length > 20) {
      return fail(30001, '单次提交事件不超过20条');
    }

    // 全部走异步，不阻塞响应
    analyticsService.trackBatch(events, openid);

    return ok({ tracked: events.length });
  });
}
