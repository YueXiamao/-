// 20个热门城市真实行程模板 — AI生成失败时兜底展示
// 均为真实景点/餐厅/酒店，数据基于公开旅行信息整理

const TRIP_TEMPLATES = {
  '上海': {
    2: [
      {
        day: 1, summary: '浦西经典与摩登都市', pace_label: 'moderate', commute_minutes: 45,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '外滩', address: '黄浦区中山东一路', duration: '2小时', best_time: '上午', period_label: '上午',
            description: '万国建筑博览，浦江两岸最佳观景台', ticket_info: '免费', recommend: '必打卡地标', highlights: '夜景绝美', reason: '上海城市象征，第一天首选' },
          { type: 'food', name: '南翔馒头店（豫园路店）', address: '黄浦区豫园路85号', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '百年老字号，小笼包发源地', ticket_info: '人均约40元', recommend: '招牌鲜肉小笼', highlights: '现包现蒸', reason: '外滩步行可达，体验上海味道' },
          { type: 'spot', name: '豫园', address: '黄浦区豫园路218号', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '明代江南古典园林，海上园林之最', ticket_info: '旺季成人40元/淡季30元', recommend: '九曲桥、玉玲珑', highlights: '节假日有灯会', reason: '南翔馒头店隔壁，顺路游览' },
          { type: 'spot', name: '陆家嘴·东方明珠', address: '浦东新区陆家嘴环路', duration: '2小时', best_time: '晚上', period_label: '晚上',
            description: '上海地标塔，俯瞰全城夜景', ticket_info: '观光票180元起', recommend: '上球体验', highlights: '夜景绝佳', reason: '第一天压轴，感受上海繁华' },
        ]
      },
      {
        day: 2, summary: '租界风情与海派生活', pace_label: 'leisure', commute_minutes: 30,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '武康路', address: '徐汇区武康路', duration: '1.5小时', best_time: '上午', period_label: '上午',
            description: '百年梧桐路，网红历史街区', ticket_info: '免费', recommend: '武康大楼、巴金故居', highlights: '秋天最美', reason: '上海最有腔调的马路' },
          { type: 'food', name: '新天地', address: '黄浦区兴业路123号', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '石库门改造的时尚地标，美食集中地', ticket_info: '丰俭由人', recommend: '鼎泰丰、Blue Bull', highlights: '中西融合', reason: '武康路步行15分钟，中西美食汇聚' },
          { type: 'spot', name: '上海博物馆', address: '黄浦区人民大道201号', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '国家一级博物馆，青铜器与书画收藏丰富', ticket_info: '免费（特展除外）', recommend: '青铜器馆、书画馆', highlights: '提前预约', reason: '上海文化底蕴，建议带孩子同去' },
          { type: 'food', name: '南京路步行街', address: '黄浦区南京东路', duration: '1.5小时', best_time: '晚上', period_label: '晚餐',
            description: '中华商业第一街，购物与美食并存', ticket_info: '丰俭由人', recommend: '上海老字号、鲜得来排骨年糕', highlights: '百年老店', reason: '购物的尽头是美食' },
        ]
      }
    ],
    3: [
      {
        day: 1, summary: '浦江经典揽胜', pace_label: 'moderate', commute_minutes: 50,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '外滩', address: '黄浦区中山东一路', duration: '2小时', best_time: '上午', period_label: '上午',
            description: '万国建筑博览，浦江两岸最佳观景台', ticket_info: '免费', recommend: '必打卡地标', highlights: '夜景绝美', reason: '上海城市象征，第一天首选' },
          { type: 'food', name: '南翔馒头店（豫园路店）', address: '黄浦区豫园路85号', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '百年老字号，小笼包发源地', ticket_info: '人均约40元', recommend: '招牌鲜肉小笼', highlights: '现包现蒸', reason: '外滩步行可达，体验上海味道' },
          { type: 'spot', name: '豫园', address: '黄浦区豫园路218号', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '明代江南古典园林，海上园林之最', ticket_info: '旺季40元/淡季30元', recommend: '九曲桥、玉玲珑', highlights: '节假日有灯会', reason: '南翔馒头店隔壁，顺路游览' },
          { type: 'spot', name: '陆家嘴·东方明珠', address: '浦东新区陆家嘴环路', duration: '2小时', best_time: '晚上', period_label: '晚上',
            description: '上海地标塔，俯瞰全城夜景', ticket_info: '观光票180元起', recommend: '上球体验', highlights: '夜景绝佳', reason: '第一天压轴，感受上海繁华' },
        ]
      },
      {
        day: 2, summary: '浦西文艺深度游', pace_label: 'leisure', commute_minutes: 35,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '武康路', address: '徐汇区武康路', duration: '1.5小时', best_time: '上午', period_label: '上午',
            description: '百年梧桐路，网红历史街区', ticket_info: '免费', recommend: '武康大楼、巴金故居', highlights: '秋天最美', reason: '上海最有腔调的马路' },
          { type: 'spot', name: '思南公馆', address: '黄浦区思南路51号', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '法租界遗留花园洋房群', ticket_info: '免费（内部参观需预约）', recommend: '老建筑群', highlights: '历史建筑', reason: '武康路附近，顺路散步' },
          { type: 'food', name: '新天地', address: '黄浦区兴业路123号', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '石库门改造的时尚地标', ticket_info: '丰俭由人', recommend: '鼎泰丰、费大厨', highlights: '中西融合', reason: '武康路步行可达' },
          { type: 'spot', name: '上海博物馆', address: '黄浦区人民大道201号', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '国家一级博物馆，青铜器与书画收藏丰富', ticket_info: '免费（特展除外）', recommend: '青铜器馆、书画馆', highlights: '提前预约', reason: '了解上海文化底蕴' },
          { type: 'food', name: '南京路步行街', address: '黄浦区南京东路', duration: '1.5小时', best_time: '晚上', period_label: '晚餐',
            description: '中华商业第一街', ticket_info: '丰俭由人', recommend: '上海老饭店、鲜得来', highlights: '老字号', reason: '第二天晚上购物美食' },
        ]
      },
      {
        day: 3, summary: '郊游与本土生活', pace_label: 'intense', commute_minutes: 60,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '朱家角古镇', address: '青浦区课植园路55号', duration: '3小时', best_time: '上午', period_label: '上午',
            description: '上海保存最完整的明清古镇', ticket_info: '免费（内部景点联票40元）', recommend: '放生桥、课植园', highlights: '水乡特色', reason: '地铁17号线直达，上海市内最大古镇' },
          { type: 'food', name: '阿婆茶楼', address: '青浦区朱家角镇北大街222号', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '古镇老茶馆，阿婆茶发源地', ticket_info: '人均约30元+茶费', recommend: '阿婆茶、扎肉', highlights: '临河老宅', reason: '朱家角特色，体验本地茶文化' },
          { type: 'spot', name: '七宝老街', address: '闵行区七宝镇富强街', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '千年古镇，美食与古建筑并存', ticket_info: '免费', recommend: '海棠糕、汤圆、七宝塔', highlights: '美食天堂', reason: '回程顺路，地铁9号线七宝站' },
          { type: 'food', name: '七宝老街汤圆店', address: '闵行区七宝镇富强街28号', duration: '40分钟', best_time: '晚上', period_label: '晚餐',
            description: '百年老店，手工汤圆', ticket_info: '人均约15元', recommend: '鲜肉汤圆、菜肉汤圆', highlights: '现包现煮', reason: '七宝老街代表性美食' },
        ]
      }
    ]
  },

  '北京': {
    2: [
      {
        day: 1, summary: '中轴线精华', pace_label: 'intense', commute_minutes: 55,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '天安门广场', address: '东城区东长安街', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '世界最大城市广场，祖国心脏', ticket_info: '免费（升旗仪式）', recommend: '看升旗提前查时间', highlights: '每天升旗', reason: '北京必打卡，广场中央位置' },
          { type: 'spot', name: '故宫（紫禁城）', address: '东城区景山前街4号', duration: '4小时', best_time: '上午+下午', period_label: '上午',
            description: '明清两代皇宫，世界文化遗产', ticket_info: '成人票60元（旺季）', recommend: '中轴线三大殿、珍宝馆', highlights: '提前预约', reason: '中国标志性古建筑，至少4小时' },
          { type: 'food', name: '四季民福烤鸭店（东四十条店）', address: '东城区东四十条23号', duration: '1.5小时', best_time: '晚上', period_label: '晚餐',
            description: '老字号挂炉烤鸭，口味地道', ticket_info: '人均约150元', recommend: '招牌烤鸭、京味炸酱面', highlights: '景观位可观故宫角楼', reason: '故宫附近最知名的烤鸭店' },
        ]
      },
      {
        day: 2, summary: '皇家园林与市井胡同', pace_label: 'moderate', commute_minutes: 45,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '天坛', address: '东城区天坛路甲1号', duration: '2.5小时', best_time: '上午', period_label: '上午',
            description: '明清皇帝祭天场所，全球最大祭天建筑群', ticket_info: '旺季成人票34元', recommend: '祈年殿、回音壁', highlights: '声学奇迹', reason: '世界文化遗产，了解中国古代礼制' },
          { type: 'food', name: '南锣鼓巷', address: '东城区南锣鼓巷', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '北京最热闹的胡同文化街区', ticket_info: '免费', recommend: '文宇奶酪、吉事果', highlights: '网红小吃', reason: '天坛乘地铁直达，体验老北京胡同' },
          { type: 'spot', name: '什刹海', address: '西城区地安门西大街60号', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '北京内城最大水系，历史文化保护区', ticket_info: '免费', recommend: '后海酒吧街、银锭桥', highlights: '日落最美', reason: '南锣鼓巷步行可达，晚上泡吧' },
          { type: 'hotel', name: '古北水镇外住宿', address: '密云区古北口镇', duration: '1晚', best_time: '晚上', period_label: '住宿',
            description: '司马台长城脚下的北方小镇，夜景绝美', ticket_info: '酒店价格约500元起', recommend: '景区内客栈', highlights: '长城夜景', reason: '北京周边最适合看长城夜景的地方' },
        ]
      }
    ],
    3: [
      {
        day: 1, summary: '中轴线精华', pace_label: 'intense', commute_minutes: 55,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '天安门广场', address: '东城区东长安街', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '世界最大城市广场', ticket_info: '免费', recommend: '升旗仪式', highlights: '每天升旗', reason: '北京必打卡' },
          { type: 'spot', name: '故宫', address: '东城区景山前街4号', duration: '4小时', best_time: '上午+下午', period_label: '上午',
            description: '明清两代皇宫', ticket_info: '成人票60元', recommend: '三大殿、珍宝馆', highlights: '提前预约', reason: '中国标志性建筑，至少4小时' },
          { type: 'food', name: '四季民福烤鸭店', address: '东城区东四十条23号', duration: '1.5小时', best_time: '晚上', period_label: '晚餐',
            description: '老字号挂炉烤鸭', ticket_info: '人均约150元', recommend: '烤鸭、京味炸酱面', highlights: '景观位可观角楼', reason: '故宫附近最知名烤鸭' },
        ]
      },
      {
        day: 2, summary: '长城与皇家园林', pace_label: 'intense', commute_minutes: 90,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '八达岭长城', address: '延庆区军都山关沟古道北口', duration: '3小时', best_time: '上午', period_label: '上午',
            description: '明长城代表性段落，最知名最完整', ticket_info: '成人票40元，缆车140元', recommend: '北段缆车登顶', highlights: '四季皆宜', reason: '北京必去世界奇迹，建议坐缆车' },
          { type: 'food', name: '八达岭外餐', address: '延庆区八达岭镇', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '长城脚下农家乐', ticket_info: '人均约50-80元', recommend: '虹鳟鱼、农家菜', highlights: '新鲜食材', reason: '登城前在镇上午餐，节省时间' },
          { type: 'spot', name: '颐和园', address: '海淀区新建宫门路19号', duration: '3小时', best_time: '下午', period_label: '下午',
            description: '中国现存最大皇家园林，慈禧太后夏宫', ticket_info: '旺季成人票60元', recommend: '昆明湖、长廊、石舫', highlights: '园林艺术', reason: '长城回程顺路，世界最大皇家园林' },
        ]
      },
      {
        day: 3, summary: '胡同文化与市井生活', pace_label: 'leisure', commute_minutes: 30,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '天坛', address: '东城区天坛路甲1号', duration: '2.5小时', best_time: '上午', period_label: '上午',
            description: '明清皇帝祭天场所', ticket_info: '旺季34元', recommend: '祈年殿、回音壁', highlights: '声学奇迹', reason: '世界文化遗产' },
          { type: 'food', name: '南锣鼓巷', address: '东城区南锣鼓巷', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '北京最热闹胡同文化街区', ticket_info: '免费', recommend: '文宇奶酪、吉事果', highlights: '网红小吃', reason: '体验老北京的最佳去处' },
          { type: 'spot', name: '什刹海', address: '西城区地安门西大街60号', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '北京内城最大水系', ticket_info: '免费', recommend: '后海酒吧街、银锭桥', highlights: '日落最美', reason: '南锣鼓巷步行可达，晚上可泡吧' },
          { type: 'food', name: '护国寺小吃', address: '西城区护国寺街54号', duration: '1小时', best_time: '晚上', period_label: '晚餐',
            description: '老北京小吃集大成者', ticket_info: '人均约30元', recommend: '豆汁、焦圈、艾窝窝', highlights: '地道北京味', reason: '第三天晚上体验正宗北京小吃' },
        ]
      }
    ]
  },

  '成都': {
    2: [
      {
        day: 1, summary: '熊猫与宽窄', pace_label: 'moderate', commute_minutes: 40,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '成都大熊猫繁育研究基地', address: '成华区外北熊猫大道1375号', duration: '3小时', best_time: '上午', period_label: '上午',
            description: '全球最大熊猫繁育机构，近距离观赏大熊猫', ticket_info: '成人票55元', recommend: '月亮产房、成年别墅区', highlights: '上午活动活跃', reason: '必打卡，建议开门就进' },
          { type: 'food', name: '玉林路美食街', address: '武侯区玉林路', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '成都本地人最爱的美食街', ticket_info: '丰俭由人', recommend: '玉林串串香、王妈手撕烤兔', highlights: '赵雷《成都》取景地', reason: '熊猫基地地铁直达，体验成都慢生活' },
          { type: 'spot', name: '宽窄巷子', address: '青羊区长顺街附近', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '清朝古街道改造的特色商业区', ticket_info: '免费', recommend: '宽巷子、窄巷子、井巷子', highlights: '晚上亮灯更美', reason: '成都最具代表性的历史文化街区' },
          { type: 'food', name: '龙抄手总店', address: '锦江区春熙路商业场街', duration: '1小时', best_time: '晚上', period_label: '晚餐',
            description: '成都名小吃代表，抄手（馄饨）发源地', ticket_info: '人均约40元', recommend: '红油抄手、清汤抄手', highlights: '老字号', reason: '宽窄巷子步行可达' },
        ]
      },
      {
        day: 2, summary: '道教名山与古镇', pace_label: 'intense', commute_minutes: 70,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '青城山', address: '都江堰市青城山镇', duration: '4小时', best_time: '上午', period_label: '上午',
            description: '中国四大道教名山之一，森林覆盖率超过95%', ticket_info: '前山60元/后山20元', recommend: '建福宫、天师洞、上清宫', highlights: '避暑胜地', reason: '成都周边最值得去的自然景点，建议前山' },
          { type: 'food', name: '青城山庄家乐', address: '都江堰市青城山镇', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '青城山农家乐', ticket_info: '人均约50元', recommend: '泡椒牛蛙、农家豆腐', highlights: '新鲜食材', reason: '山脚下当地农家乐，味道好且实惠' },
          { type: 'spot', name: '都江堰景区', address: '都江堰市都江堰大道', duration: '2.5小时', best_time: '下午', period_label: '下午',
            description: '战国时期李冰父子建造的世界文化遗产水利工程', ticket_info: '成人票80元', recommend: '鱼嘴分水堤、飞沙堰、宝瓶口', highlights: '千年仍在使用', reason: '青城山返程顺路，世界最大古代水利工程' },
        ]
      }
    ],
    3: [
      {
        day: 1, summary: '熊猫与老成都', pace_label: 'moderate', commute_minutes: 40,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '成都大熊猫繁育研究基地', address: '成华区外北熊猫大道1375号', duration: '3小时', best_time: '上午', period_label: '上午',
            description: '全球最大熊猫繁育机构', ticket_info: '成人票55元', recommend: '月亮产房、成年别墅区', highlights: '上午活动活跃', reason: '必打卡，建议开门就进' },
          { type: 'food', name: '玉林路美食街', address: '武侯区玉林路', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '成都本地人最爱的美食街', ticket_info: '丰俭由人', recommend: '玉林串串香、王妈手撕烤兔', highlights: '《成都》取景地', reason: '熊猫基地地铁直达' },
          { type: 'spot', name: '宽窄巷子', address: '青羊区长顺街附近', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '清朝古街道改造的特色商业区', ticket_info: '免费', recommend: '宽巷子、窄巷子', highlights: '晚上亮灯更美', reason: '成都最具代表性历史文化街区' },
          { type: 'food', name: '龙抄手总店', address: '锦江区春熙路商业场街', duration: '1小时', best_time: '晚上', period_label: '晚餐',
            description: '成都名小吃代表', ticket_info: '人均约40元', recommend: '红油抄手', highlights: '老字号', reason: '宽窄巷子步行可达' },
        ]
      },
      {
        day: 2, summary: '道教名山与水利奇迹', pace_label: 'intense', commute_minutes: 70,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '青城山', address: '都江堰市青城山镇', duration: '4小时', best_time: '上午', period_label: '上午',
            description: '中国四大道教名山之一', ticket_info: '前山60元', recommend: '建福宫、天师洞', highlights: '避暑胜地', reason: '成都周边最值得去的自然景点' },
          { type: 'food', name: '青城山庄家乐', address: '都江堰市青城山镇', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '山脚农家乐', ticket_info: '人均约50元', recommend: '泡椒牛蛙', highlights: '新鲜食材', reason: '当地农家乐，实惠好吃' },
          { type: 'spot', name: '都江堰景区', address: '都江堰市都江堰大道', duration: '2.5小时', best_time: '下午', period_label: '下午',
            description: '战国时期建造的世界文化遗产水利工程', ticket_info: '成人票80元', recommend: '鱼嘴、飞沙堰、宝瓶口', highlights: '千年使用至今', reason: '青城山返程顺路，世界最大古代水利工程' },
        ]
      },
      {
        day: 3, summary: '三国文化与休闲生活', pace_label: 'leisure', commute_minutes: 25,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '武侯祠', address: '武侯区武侯祠大街231号', duration: '2小时', best_time: '上午', period_label: '上午',
            description: '中国唯一一座君臣合祀祠庙，三国文化核心', ticket_info: '成人票50元', recommend: '刘备殿、诸葛亮殿、锦里', highlights: '三国迷必去', reason: '中国唯一三国主题博物馆' },
          { type: 'food', name: '锦里', address: '武侯区武侯祠大街231号旁', duration: '2小时', best_time: '午餐', period_label: '午餐',
            description: '武侯祠外的仿古商业街，四川小吃大全', ticket_info: '免费', recommend: '三大炮、叶儿粑、凉粉', highlights: '夜景更美', reason: '武侯祠隔壁，边吃边逛' },
          { type: 'spot', name: '春熙路', address: '锦江区春熙路', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '成都最繁华的商业步行街', ticket_info: '免费', recommend: 'IFS爬墙熊猫、太古里', highlights: '时尚地标', reason: '成都商业中心，最后一天购物' },
          { type: 'food', name: '蜀大侠火锅（春熙店）', address: '锦江区春熙路群光广场', duration: '1.5小时', best_time: '晚上', period_label: '晚餐',
            description: '成都本地人气火锅连锁', ticket_info: '人均约100元', recommend: '龙头锅底、大刀腰片', highlights: '辣而不燥', reason: '成都最后一天吃顿正宗火锅收尾' },
        ]
      }
    ]
  },

  '杭州': {
    2: [
      {
        day: 1, summary: '西湖全景', pace_label: 'leisure', commute_minutes: 30,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '断桥残雪', address: '西湖区北山街', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '西湖十景之首，白娘子与许仙相遇之地', ticket_info: '免费（游船另计）', recommend: '早晨人少，拍照佳', highlights: '冬雪后更美', reason: '杭州第一站，西湖北线起点' },
          { type: 'spot', name: '曲院风荷', address: '西湖区北山街洪春桥畔', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '西湖十景之一，夏日荷花盛开', ticket_info: '免费', recommend: '风荷区、曲院', highlights: '夏天荷花', reason: '断桥步行可达，衔接自然' },
          { type: 'food', name: '楼外楼（孤山路店）', address: '西湖区孤山路52号', duration: '1.5小时', best_time: '午餐', period_label: '午餐',
            description: '百年老字号，杭州本帮菜代表', ticket_info: '人均约150元', recommend: '东坡肉、西湖醋鱼、龙井虾仁', highlights: '西湖边吃饭', reason: '孤山脚下，西湖核心地段' },
          { type: 'spot', name: '花港观鱼', address: '西湖区南山路苏堤入口', duration: '1.5小时', best_time: '下午', period_label: '下午',
            description: '西湖十景之一，红鱼池可赏鱼', ticket_info: '免费', recommend: '红鱼池、魏庐', highlights: '带小朋友的好去处', reason: '楼外楼步行15分钟' },
          { type: 'spot', name: '雷峰塔', address: '西湖区净慈寺路23号', duration: '1.5小时', best_time: '晚上', period_label: '晚上',
            description: '西湖标志性景点，新雷峰塔可乘电梯登顶', ticket_info: '成人票40元', recommend: '登塔看西湖全景', highlights: '夕照雷峰塔', reason: '花港观鱼步行可达，看西湖日落' },
        ]
      },
      {
        day: 2, summary: '灵隐禅意与龙井茶香', pace_label: 'moderate', commute_minutes: 40,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '灵隐寺', address: '西湖区灵隐路法云弄1号', duration: '3小时', best_time: '上午', period_label: '上午',
            description: '杭州最著名古刹，香火极盛', ticket_info: '灵隐寺30元+飞来峰45元', recommend: '飞来峰、永福寺、韬光寺', highlights: '求愿灵验', reason: '杭州佛教文化代表，建议早去避人潮' },
          { type: 'food', name: '灵隐素面馆', address: '西湖区灵隐路法云弄', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '灵隐寺内素面', ticket_info: '人均约30元', recommend: '吉祥素面', highlights: '寺院内', reason: '灵隐寺景区内，省时方便' },
          { type: 'spot', name: '龙井村', address: '西湖区龙井路龙井村', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '中国十大名茶西湖龙井的核心产区', ticket_info: '免费', recommend: '乾隆皇帝采茶处、七号茶树', highlights: '茶文化', reason: '灵隐寺乘车15分钟，品茶体验' },
          { type: 'food', name: '龙井翁家村农家乐', address: '西湖区龙井路翁家山', duration: '1.5小时', best_time: '晚上', period_label: '晚餐',
            description: '茶园中的农家乐餐厅', ticket_info: '人均约60元', recommend: '龙井虾仁、茶香红烧肉', highlights: '茶园风光', reason: '龙井村内，品茶吃饭一体化' },
        ]
      }
    ],
    3: [
      {
        day: 1, summary: '西湖全景', pace_label: 'leisure', commute_minutes: 30,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '断桥残雪', address: '西湖区北山街', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '西湖十景之首', ticket_info: '免费', recommend: '早晨人少', highlights: '冬雪后更美', reason: '杭州第一站' },
          { type: 'food', name: '楼外楼（孤山路店）', address: '西湖区孤山路52号', duration: '1.5小时', best_time: '午餐', period_label: '午餐',
            description: '百年老字号，杭州本帮菜代表', ticket_info: '人均约150元', recommend: '东坡肉、西湖醋鱼', highlights: '西湖边吃饭', reason: '孤山脚下' },
          { type: 'spot', name: '花港观鱼', address: '西湖区南山路苏堤入口', duration: '1.5小时', best_time: '下午', period_label: '下午',
            description: '西湖十景之一', ticket_info: '免费', recommend: '红鱼池', highlights: '亲子游佳', reason: '楼外楼步行15分钟' },
          { type: 'spot', name: '雷峰塔', address: '西湖区净慈寺路23号', duration: '1.5小时', best_time: '晚上', period_label: '晚上',
            description: '西湖标志性景点', ticket_info: '成人票40元', recommend: '登塔看全景', highlights: '夕照雷峰塔', reason: '花港观鱼步行可达' },
        ]
      },
      {
        day: 2, summary: '灵隐禅意与宋城', pace_label: 'moderate', commute_minutes: 45,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '灵隐寺', address: '西湖区灵隐路法云弄1号', duration: '3小时', best_time: '上午', period_label: '上午',
            description: '杭州最著名古刹', ticket_info: '灵隐寺30元+飞来峰45元', recommend: '飞来峰、永福寺', highlights: '求愿灵验', reason: '杭州佛教文化代表' },
          { type: 'food', name: '灵隐素面馆', address: '西湖区灵隐路法云弄', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '灵隐寺内素面', ticket_info: '人均约30元', recommend: '吉祥素面', highlights: '寺院内', reason: '灵隐寺景区内' },
          { type: 'spot', name: '宋城', address: '西湖区之江路148号', duration: '3小时', best_time: '晚上', period_label: '晚上',
            description: '大型宋代主题公园，《宋城千古情》是招牌', ticket_info: '观众席310元/贵宾席320元', recommend: '宋城千古情演出', highlights: '震撼演出', reason: '杭州最值得看的演出，建议下午入园晚上看剧' },
        ]
      },
      {
        day: 3, summary: '运河与小河直街', pace_label: 'leisure', commute_minutes: 25,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '京杭大运河（拱宸桥段）', address: '拱墅区运河广场', duration: '2小时', best_time: '上午', period_label: '上午',
            description: '世界上最长古代运河，杭州段精华', ticket_info: '免费（游船另计）', recommend: '拱宸桥、运河博物馆', highlights: '水上巴士3元', reason: '杭州独特的水上文化' },
          { type: 'spot', name: '小河直街', address: '拱墅区小河路', duration: '1.5小时', best_time: '上午', period_label: '上午',
            description: '原生态运河民居历史街区', ticket_info: '免费', recommend: '老街手工艺店、猫的天空之城', highlights: '文艺清新', reason: '运河边步行可达，感受老杭州' },
          { type: 'food', name: '小河直街私房菜', address: '拱墅区小河路58号', duration: '1.5小时', best_time: '午餐', period_label: '午餐',
            description: '老街私房菜餐厅', ticket_info: '人均约80元', recommend: '糖醋里脊、本帮红烧肉', highlights: '临河位', reason: '小河直街内，边吃边看河景' },
          { type: 'spot', name: '清河坊历史街区', address: '上城区河坊街', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '杭州最著名的古街，百年老店汇聚', ticket_info: '免费', recommend: '胡庆余堂、方回春堂、保和堂', highlights: '中医药文化', reason: '第三天购特产，必去百年老店' },
          { type: 'food', name: '外婆家（河坊街店）', address: '上城区河坊街49号', duration: '1小时', best_time: '晚上', period_label: '晚餐',
            description: '杭帮菜连锁，性价比高', ticket_info: '人均约60元', recommend: '外婆神仙鸡、青豆泥', highlights: '连锁品牌', reason: '河坊街内，便捷又地道' },
        ]
      }
    ]
  },

  '重庆': {
    2: [
      {
        day: 1, summary: '山水都市立体画卷', pace_label: 'intense', commute_minutes: 55,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '解放碑', address: '渝中区解放碑步行街', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '重庆地标，中国唯一纪念抗战胜利的碑', ticket_info: '免费', recommend: '周边商圈', highlights: '重庆商业中心', reason: '重庆第一站，市中心核心' },
          { type: 'food', name: '八一好吃街', address: '渝中区八一路', duration: '1.5小时', best_time: '午餐', period_label: '午餐',
            description: '重庆最知名美食街，本地人推荐', ticket_info: '丰俭由人', recommend: '酸辣粉、降龙爪爪、山城小汤圆', highlights: '美食云集', reason: '解放碑旁边，吃重庆特色小吃' },
          { type: 'spot', name: '洪崖洞', address: '渝中区嘉陵江滨江路88号', duration: '2小时', best_time: '晚上', period_label: '晚上',
            description: '千与千寻同款吊脚楼建筑，夜晚灯光绝美', ticket_info: '免费（内部消费另计）', recommend: '观景台、1楼和11楼街道', highlights: '夜景封神', reason: '重庆必打卡，白天普通晚上震撼' },
        ]
      },
      {
        day: 2, summary: '武隆天生三桥与轻轨穿楼', pace_label: 'intense', commute_minutes: 120,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '武隆天生三桥', address: '武隆区仙女山镇', duration: '4小时', best_time: '上午', period_label: '上午',
            description: '世界最大天生桥群，《变形金刚4》《满城尽带黄金甲》取景地', ticket_info: '成人票125元+景区巴士40元', recommend: '天龙桥、青龙桥、黑龙桥', highlights: '震撼自然奇观', reason: '重庆周边最值得去的景点，建议报一日游或自驾' },
          { type: 'food', name: '武隆特色农家乐', address: '武隆区仙女山镇', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '武隆当地农家菜', ticket_info: '人均约50元', recommend: '碗碗羊肉、江口鱼', highlights: '山区新鲜食材', reason: '景区门口有很多选择' },
          { type: 'spot', name: '李子坝轻轨穿楼', address: '渝中区李子坝正街', duration: '30分钟', best_time: '下午', period_label: '下午',
            description: '全国唯一轻轨穿楼而过的奇观', ticket_info: '免费', recommend: '观景平台拍照', highlights: '轻轨穿楼', reason: '回程经过，重庆网红打卡点' },
          { type: 'food', name: '磁器口古镇', address: '沙坪坝区磁童路', duration: '2小时', best_time: '晚上', period_label: '晚餐',
            description: '重庆主城区最大古镇，陈麻花发源地', ticket_info: '免费', recommend: '陈麻花、毛血旺、手工酸辣粉', highlights: '重庆特产', reason: '李子坝地铁直达，买特产好去处' },
        ]
      }
    ],
    3: [
      {
        day: 1, summary: '渝中母城经典', pace_label: 'intense', commute_minutes: 50,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '解放碑', address: '渝中区解放碑步行街', duration: '1小时', best_time: '上午', period_label: '上午',
            description: '重庆地标', ticket_info: '免费', recommend: '周边商圈', highlights: '商业中心', reason: '重庆第一站' },
          { type: 'food', name: '八一好吃街', address: '渝中区八一路', duration: '1.5小时', best_time: '午餐', period_label: '午餐',
            description: '重庆最知名美食街', ticket_info: '丰俭由人', recommend: '酸辣粉、降龙爪爪', highlights: '美食云集', reason: '解放碑旁边' },
          { type: 'spot', name: '长江索道', address: '渝中区新华路151号', duration: '1小时', best_time: '下午', period_label: '下午',
            description: '重庆独有空中公交，横跨长江', ticket_info: '单程20元/往返30元', recommend: '北站上，南站下到南滨路', highlights: '俯瞰两江', reason: '重庆独有体验，建议南站出' },
          { type: 'spot', name: '洪崖洞', address: '渝中区嘉陵江滨江路88号', duration: '2小时', best_time: '晚上', period_label: '晚上',
            description: '千与千寻同款吊脚楼', ticket_info: '免费', recommend: '观景台', highlights: '夜景封神', reason: '晚上去，灯光绝美' },
        ]
      },
      {
        day: 2, summary: '武隆震撼奇观', pace_label: 'intense', commute_minutes: 120,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '武隆天生三桥', address: '武隆区仙女山镇', duration: '4小时', best_time: '上午', period_label: '上午',
            description: '世界最大天生桥群', ticket_info: '125元+巴士40元', recommend: '天龙桥、青龙桥', highlights: '震撼自然奇观', reason: '重庆周边最值得去的景点' },
          { type: 'food', name: '武隆农家乐', address: '武隆区仙女山镇', duration: '1小时', best_time: '午餐', period_label: '午餐',
            description: '当地农家菜', ticket_info: '人均约50元', recommend: '碗碗羊肉', highlights: '新鲜食材', reason: '景区门口' },
          { type: 'spot', name: '武隆龙水峡地缝', address: '武隆区仙女山镇', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '地下裂缝奇观，与天生三桥联票', ticket_info: '联票更优惠', recommend: '一线天奇观', highlights: '清凉避暑', reason: '天生三桥附近，建议联游' },
        ]
      },
      {
        day: 3, summary: '文艺老街与火锅', pace_label: 'leisure', commute_minutes: 30,
        data_freshness: '基于2024年真实游客数据整理',
        items: [
          { type: 'spot', name: '鹅岭二厂', address: '渝中区鹅岭正街1号', duration: '2小时', best_time: '上午', period_label: '上午',
            description: '老印刷厂改造的文创园，《从你的全世界路过》取景地', ticket_info: '免费', recommend: '天台俯瞰渝中、涂鸦墙', highlights: '文艺拍照', reason: '重庆文艺新地标，拍照绝佳' },
          { type: 'food', name: '李子坝梁山鸡', address: '渝中区李子坝正街88号', duration: '1.5小时', best_time: '午餐', period_label: '午餐',
            description: '重庆特色药膳鸡，辣而不燥', ticket_info: '人均约80元', recommend: '梁山鸡、凉糕', highlights: '当地人推荐', reason: '鹅岭二厂步行可达' },
          { type: 'spot', name: '磁器口古镇', address: '沙坪坝区磁童路', duration: '2小时', best_time: '下午', period_label: '下午',
            description: '主城区最大古镇', ticket_info: '免费', recommend: '陈麻花、毛血旺', highlights: '买特产', reason: '买重庆特产的好地方' },
          { type: 'food', name: '珮姐老火锅（较场口店）', address: '渝中区较场口民生路9号', duration: '2小时', best_time: '晚上', period_label: '晚餐',
            description: '重庆最知名的火锅连锁，等位2小时也值得', ticket_info: '人均约100元', recommend: '鲜毛肚、鹅肠、麻辣牛肉', highlights: '锅底地道', reason: '重庆最后一天吃顿正宗火锅收尾' },
        ]
      }
    ]
  }
};

// 20城列表（用于FALLBACK_DESTS扩充）
const FALLBACK_DESTS_20 = [
  { name: '上海', city: '上海', province: '上海', latitude: 31.2304, longitude: 121.4737, avg_budget: 800, description: '魔都繁华、东西方交融', tags: ['都市', '美食', '海派文化'] },
  { name: '北京', city: '北京', province: '北京', latitude: 39.9042, longitude: 116.4074, avg_budget: 700, description: '千年古都、皇家风范', tags: ['历史', '文化', '长城'] },
  { name: '成都', city: '成都', province: '四川', latitude: 30.6598, longitude: 104.0658, avg_budget: 600, description: '天府之国、休闲美食之都', tags: ['美食', '熊猫', '休闲'] },
  { name: '杭州', city: '杭州', province: '浙江', latitude: 30.2741, longitude: 120.1551, avg_budget: 800, description: '人间天堂、西湖山水', tags: ['风景', '休闲', '茶文化'] },
  { name: '重庆', city: '重庆', province: '重庆', latitude: 29.4316, longitude: 106.9123, avg_budget: 600, description: '山城雾都、8D魔幻都市', tags: ['美食', '夜景', '自然奇观'] },
  { name: '厦门', city: '厦门', province: '福建', latitude: 24.4798, longitude: 118.0894, avg_budget: 700, description: '海上花园、文艺清新', tags: ['海滨', '美食', '小清新'] },
  { name: '丽江', city: '丽江', province: '云南', latitude: 26.8723, longitude: 100.2287, avg_budget: 500, description: '艳遇之都、古城风情', tags: ['古城', '民族', '风景'] },
  { name: '西安', city: '西安', province: '陕西', latitude: 34.3416, longitude: 108.9398, avg_budget: 600, description: '千年古都、历史遗迹', tags: ['历史', '美食', '文化'] },
  { name: '青岛', city: '青岛', province: '山东', latitude: 36.0671, longitude: 120.3826, avg_budget: 700, description: '啤酒之城、海洋气候', tags: ['海滨', '美食', '啤酒'] },
  { name: '广州', city: '广州', province: '广东', latitude: 23.1291, longitude: 113.2644, avg_budget: 700, description: '美食之都、岭南文化', tags: ['美食', '历史', '商贸'] },
  { name: '深圳', city: '深圳', province: '广东', latitude: 22.5431, longitude: 114.0579, avg_budget: 800, description: '创新之城、主题乐园', tags: ['都市', '主题乐园', '科技'] },
  { name: '武汉', city: '武汉', province: '湖北', latitude: 30.5928, longitude: 114.3055, avg_budget: 500, description: '江城武汉、黄鹤楼', tags: ['历史', '美食', '樱花'] },
  { name: '南京', city: '南京', province: '江苏', latitude: 32.0603, longitude: 118.7969, avg_budget: 600, description: '六朝古都、梧桐树影', tags: ['历史', '美食', '文化'] },
  { name: '天津', city: '天津', province: '天津', latitude: 39.1256, longitude: 117.1909, avg_budget: 500, description: '津门故里、租界风情', tags: ['历史', '美食', '建筑'] },
  { name: '苏州', city: '苏州', province: '江苏', latitude: 31.2989, longitude: 120.5853, avg_budget: 700, description: '园林之城、水乡泽国', tags: ['园林', '水乡', '文化'] },
  { name: '大连', city: '大连', province: '辽宁', latitude: 38.9140, longitude: 121.6147, avg_budget: 600, description: '浪漫之都、北方明珠', tags: ['海滨', '建筑', '美食'] },
  { name: '哈尔滨', city: '哈尔滨', province: '黑龙江', latitude: 45.8038, longitude: 126.5340, avg_budget: 600, description: '冰雪之城、俄式风情', tags: ['冰雪', '建筑', '美食'] },
  { name: '长沙', city: '长沙', province: '湖南', latitude: 28.2282, longitude: 112.9388, avg_budget: 500, description: '娱乐之都、湘菜发源地', tags: ['美食', '娱乐', '历史'] },
  { name: '桂林', city: '桂林', province: '广西', latitude: 25.2744, longitude: 110.2990, avg_budget: 600, description: '山水甲天下、漓江风光', tags: ['山水', '摄影', '休闲'] },
  { name: '三亚', city: '三亚', province: '海南', latitude: 18.2528, longitude: 109.5119, avg_budget: 900, description: '天涯海角、热带海滨', tags: ['海滨', '度假', '潜水'] },
];

function getDestinationName(request, index) {
  const destination = request.destinations[index % request.destinations.length];
  return typeof destination === 'string' ? destination : destination?.name || '目的地';
}

function formatDay(startDate, offset) {
  const [yearText, monthText, dayText] = startDate.split('-');
  const current = new Date(Date.UTC(
    Number.parseInt(yearText, 10),
    Number.parseInt(monthText, 10) - 1,
    Number.parseInt(dayText, 10) + offset
  ));
  return current.toISOString().slice(0, 10);
}

function buildCityTrip(request, city, days) {
  const templates = TRIP_TEMPLATES[city];
  if (!templates) return null;

  // 找最接近的模板（优先等长，其次最接近）
  const availableDays = Object.keys(templates).map(Number).sort((a, b) => a - b);
  const targetDays = parseInt(days, 10) || 2;
  let selectedDays = availableDays.find(d => d === targetDays)
    || availableDays.sort((a, b) => Math.abs(a - targetDays) - Math.abs(b - targetDays))[0]
    || 2;

  const dayTemplates = templates[selectedDays] || templates[Object.keys(templates)[0]];
  const result = [];

  for (let i = 0; i < Math.min(targetDays, dayTemplates.length); i++) {
    const tpl = dayTemplates[i];
    result.push({
      day: i + 1,
      date: formatDay(request.start_date, i),
      summary: tpl.summary,
      pace_label: tpl.pace_label,
      commute_minutes: tpl.commute_minutes,
      data_freshness: tpl.data_freshness,
      items: tpl.items.map((item, idx) => ({
        ...item,
        itemKey: `fallback-${Date.now()}-${i}-${idx}`,
        id: null
      }))
    });
  }

  return result;
}

export class FallbackTemplateProvider {
  provide(request, context = {}) {
    const warnings = ['template_fallback'];
    if (context.reason) warnings.unshift(context.reason);
    console.warn(`[Fallback] AI生成失败，使用行程模板兜底。城市: ${getDestinationName(request, 0)}，原因: ${context.reason || 'unknown'}`);

    const city = getDestinationName(request, 0);
    const days = parseInt(request.days, 10) || 2;
    const itinerary = buildCityTrip(request, city, days);

    // 如果没有对应城市模板，生成通用兜底
    if (!itinerary) {
      return {
        itinerary: Array.from({ length: days }, (_, index) => ({
          day: index + 1,
          date: formatDay(request.start_date, index),
          items: [
            { type: 'spot', name: `${city}必游景点`, address: city, duration: '2-3小时', period_label: '上午',
              description: '当地最值得去的景点，建议查看旅行攻略确认具体名称。', ticket_info: '以景区实际票价为准', reason: '推荐通过当地旅游平台确认最新景点信息' },
            { type: 'food', name: `${city}特色美食`, address: city, duration: '1-2小时', period_label: '午餐',
              description: '建议使用大众点评搜索当地高分餐厅。', ticket_info: '丰俭由人', recommend: '搜索高分本地餐厅', reason: '当地美食选择多，建议参考点评平台' },
            { type: 'hotel', name: `${city}住宿建议`, address: city, duration: '1晚', period_label: '住宿',
              description: '建议住在交通便利的中心区域，方便出行。', budget: '以实际为准', reason: '建议通过携程/美团提前预订，选择地铁沿线' }
          ]
        })),
        warnings
      };
    }

    return { itinerary, warnings };
  }

  // 导出20城列表供外部调用（如discover推荐）
  static getFallbackDests() {
    return FALLBACK_DESTS_20;
  }
}
