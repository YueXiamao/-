// 常量定义

// 游玩方式选项
export const PREFERENCE_OPTIONS = [
  { label: '轻松度假', value: '轻松度假', icon: '[休]' },
  { label: '网红打卡', value: '网红打卡', icon: '[红]' },
  { label: '寻找美食', value: '寻找美食', icon: '[食]' },
  { label: '亲子友好', value: '亲子友好', icon: '[童]' },
  { label: '文化探索', value: '文化探索', icon: '[文]' },
  { label: '户外徒步', value: '户外徒步', icon: '[徒]' },
  { label: '购物休闲', value: '购物休闲', icon: '[购]' }
];

// 预算选项
export const BUDGET_OPTIONS = [
  { label: '500元以下', value: '500以下', desc: '周边穷游' },
  { label: '500-1000元', value: '500-1000', desc: '周末轻度假' },
  { label: '1000-2000元', value: '1000-2000', desc: '标准旅游' },
  { label: '2000-5000元', value: '2000-5000', desc: '品质游' },
  { label: '5000元以上', value: '5000以上', desc: '高端/出境' }
];

// 天数范围
export const MIN_DAYS = 1;
export const MAX_DAYS = 14;

// API 域名配置
export const API_BASE_URL = 'https://api.travel.com'; // TODO: 上线时配置
export const API_TEST_URL = 'http://localhost:3000';  // 开发环境

// 行程单项类型
export const ITEM_TYPES = {
  SPOT: 'spot',
  FOOD: 'food',
  HOTEL: 'hotel',
  TRANSPORT: 'transport'
};

// 行程来源
export const TRIP_SOURCE = {
  PLAN: 'plan',
  DISCOVER: 'discover'
};
