/**
 * 统一 API 响应格式
 * 所有路由统一返回: { code, message, data }
 * - code: 0=成功, >0=业务错误
 * - message: 描述文字
 * - data: 业务数据（可为 null）
 */

export function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

export function fail(code, message = 'error') {
  return { code, message };
}

export function created(data = null, message = 'created') {
  return { code: 0, message, data };
}
