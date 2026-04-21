// 后端服务入口文件
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import destinationsRouter from './routes/destinations.js';
import poisRouter from './routes/pois.js';
import tripRouter from './routes/trip.js';
import discoverRouter from './routes/discover.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import { errorHandler } from './middleware/errorHandler.js';

// 创建 Fastify 实例
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
    }
  }
});

// 注册中间件
await fastify.register(cors, {
  origin: true,
  credentials: true
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  message: { code: 429, message: '请求过于频繁，请稍后再试' }
});

// 注册路由
await fastify.register(destinationsRouter, { prefix: '/api/destinations' });
await fastify.register(poisRouter, { prefix: '/api/pois' });
await fastify.register(tripRouter, { prefix: '/api/trip' });
await fastify.register(discoverRouter, { prefix: '/api/discover' });
await fastify.register(authRouter, { prefix: '/api/auth' });
await fastify.register(userRouter, { prefix: '/api/user' });

// 错误处理
fastify.setErrorHandler(errorHandler);

// 健康检查
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// 启动服务
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`✅ Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
