// 环境变量配置
import 'dotenv/config.js';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),

  // 数据库
  db: {
    // 类型：sqlite | mysql，默认为 sqlite
    type: process.env.DB_TYPE || 'sqlite',
    // SQLite 配置
    path: process.env.DB_PATH || '/home/fanruulin/hermes-home-linux/data/travel-miniprogram/travel.db',
    nativeBinding: process.env.BETTER_SQLITE3_NATIVE_BINDING || '',
    // MySQL 配置
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_planner',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0'),
    enabled: process.env.REDIS_ENABLED === 'true'
  },

  // 高德地图 Web API Key
  amap: {
    key: process.env.AMAP_KEY || '',
    secret: process.env.AMAP_SECRET || ''
  },

  // AI 服务
  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic', // 'claude' | 'anthropic' | 'openai'
    model: process.env.AI_MODEL || 'minimax-7B-250618',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.minimaxi.com/anthropic/v',
    timeout: 15000
  },

  // 微信
  wechat: {
    appid: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || ''
  }
};
