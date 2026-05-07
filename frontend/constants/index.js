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
export const CITY_BACKGROUND_OPTIONS = {
  default: '/assets/backgrounds/city-default.png',
  mountain: '/assets/backgrounds/city-mountain.png',
  coast: '/assets/backgrounds/city-coast.png',
  urban: '/assets/backgrounds/city-urban.png',
  snow: '/assets/backgrounds/city-snow.png',
  water: '/assets/backgrounds/city-water.png'
};

const CITY_BACKGROUND_KEYWORDS = [
  { type: 'mountain', words: ['成都', '都江堰', '重庆', '西安', '桂林', '张家界', '峨眉', '乐山'] },
  { type: 'coast', words: ['厦门', '三亚', '青岛', '舟山', '海口', '大连', '珠海', '北海'] },
  { type: 'urban', words: ['上海', '北京', '深圳', '广州', '杭州', '南京', '武汉', '长沙'] },
  { type: 'snow', words: ['丽江', '大理', '拉萨', '香格里拉', '西宁', '阿坝', '甘孜'] },
  { type: 'water', words: ['苏州', '无锡', '嘉兴', '湖州', '绍兴', '扬州', '乌镇', '周庄'] }
];

export function getCityBackground(destinationNames = []) {
  const text = destinationNames
    .map(item => (typeof item === 'string' ? item : item?.name || item?.city || item?.province || ''))
    .join(' ');
  const match = CITY_BACKGROUND_KEYWORDS.find(group => group.words.some(word => text.includes(word)));
  return CITY_BACKGROUND_OPTIONS[match?.type || 'default'];
}

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
export const API_DEVTOOLS_URL = 'http://127.0.0.1:3002';
// For real-device debugging, keep this value aligned with the WLAN IPv4 address
// of the computer running backend.
export const API_TEST_URL = 'http://192.168.20.141:3002';

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
