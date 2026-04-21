// Fastify 服务入口
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { initDatabase } from './db/database.js';
import { errorHandler } from './middleware/errorHandler.js';

// 路由
import authRoutes from './routes/auth.js';
import destinationRoutes from './routes/destinations.js';
import poiRoutes from './routes/pois.js';
import tripRoutes from './routes/trip.js';
import discoverRoutes from './routes/discover.js';
import userRoutes from './routes/user.js';

const fastify = Fastify({ logger: true });

// 注册插件
await fastify.register(cors, {
  origin: true,
  credentials: true
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// 初始化数据库
initDatabase();

// 注册错误处理器
fastify.setErrorHandler(errorHandler);

// 注册路由
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(destinationRoutes, { prefix: '/api/destinations' });
fastify.register(poiRoutes, { prefix: '/api/pois' });
fastify.register(tripRoutes, { prefix: '/api/trip' });
fastify.register(discoverRoutes, { prefix: '/api/discover' });
fastify.register(userRoutes, { prefix: '/api/user' });

// 健康检查
fastify.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

// 启动
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 服务已启动: http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
