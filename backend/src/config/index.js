// 环境变量配置
import 'dotenv/config.js';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),

  // 数据库 SQLite（本地文件）
  db: {
    path: process.env.DB_PATH || './data/travel.db'
  },

  // Redis（可选，本地开发可跳过）
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    enabled: process.env.REDIS_ENABLED === 'true'
  },

  // 高德地图 Web API Key
  amap: {
    key: process.env.AMAP_KEY || '',
    secret: process.env.AMAP_SECRET || ''
  },

  // AI 服务
  ai: {
    provider: process.env.AI_PROVIDER || 'openai', // 'claude' | 'openai'
    model: process.env.AI_MODEL || 'abab6.5s-chat',
    apiKey: process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.minimax.chat/v',
    timeout: 15000 // 15秒超时
  },

  // 微信
  wechat: {
    appid: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || ''
  }
};
