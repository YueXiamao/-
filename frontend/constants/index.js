// 常量定义

// 游玩方式选项（使用本地PNG图标）
export const PREFERENCE_OPTIONS = [
  { label: '轻松度假', value: '轻松度假', icon: '/assets/pref-icons/vacation.png' },
  { label: '网红打卡', value: '网红打卡', icon: '/assets/pref-icons/checkin.png' },
  { label: '寻找美食', value: '寻找美食', icon: '/assets/pref-icons/food.png' },
  { label: '亲子友好', value: '亲子友好', icon: '/assets/pref-icons/family.png' },
  { label: '文化探索', value: '文化探索', icon: '/assets/pref-icons/culture.png' },
  { label: '户外徒步', value: '户外徒步', icon: '/assets/pref-icons/hiking.png' },
  { label: '购物休闲', value: '购物休闲', icon: '/assets/pref-icons/shopping.png' }
];

// 预算选项
export const BUDGET_OPTIONS = [
  { label: '500元以下', value: '500以下', desc: '周边穷游' },
  { label: '500-1000元', value: '500-1000', desc: '周末轻度假' },
  { label: '1000-2000元', value: '1000-2000', desc: '标准旅游' },
  { label: '2000-5000元', value: '2000-5000', desc: '品质游' },
  { label: '5000元以上', value: '5000以上', desc: '高端/出境' }
];

export const MIN_DAYS = 1;
export const MAX_DAYS = 14;

export const API_BASE_URL = 'https://api.travel.com';
export const API_TEST_URL = 'http://localhost:3000';

export const ITEM_TYPES = {
  SPOT: 'spot',
  FOOD: 'food',
  HOTEL: 'hotel',
  TRANSPORT: 'transport'
};

export const TRIP_SOURCE = {
  PLAN: 'plan',
  DISCOVER: 'discover'
};
