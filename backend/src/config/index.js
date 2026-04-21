// 环境变量配置
// 实际使用时创建 .env 文件，复制所有变量进去

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,

  // 数据库
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_planner',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },

  // 高德地图
  amap: {
    key: process.env.AMAP_KEY || '',
    secret: process.env.AMAP_SECRET || ''
  },

  // AI 服务
  ai: {
    provider: process.env.AI_PROVIDER || 'claude', // 'claude' | 'openai'
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    apiKey: process.env.CLAUDE_API_KEY || '',
    timeout: 10000 // 10秒超时
  },

  // 微信
  wechat: {
    appid: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || ''
  }
};
