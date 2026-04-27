// 全局错误处理中间件
export const errorHandler = (error, request, reply) => {
  const statusCode = error.statusCode || 500;

  // 记录错误日志
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
    body: request.body
  });

  // 构建响应
  const response = {
    code: error.code || statusCode,
    message: error.message || '服务器内部错误',
    errors: error.validationErrors || [],
    retryable: error.retryable === true
  };

  reply.status(statusCode).send(response);
};

// 统一错误类
export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

// 预定义错误
export const Errors = {
  VALIDATION_ERROR: (msg) => new AppError(10001, msg, 400),
  NOT_FOUND: (msg = '资源不存在') => new AppError(10002, msg, 404),
  UNAUTHORIZED: (msg = '未授权') => new AppError(10003, msg, 401),
  AMAP_ERROR: (msg) => new AppError(20001, msg, 502),
  AI_ERROR: (msg) => new AppError(20002, msg, 502),
  EMPTY_DESTINATION: () => new AppError(20003, '目的地数据为空', 400),
  INTERNAL_ERROR: (msg = '服务器内部错误') => new AppError(30001, msg, 500)
};
