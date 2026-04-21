# AI 服务文档

**版本：** v1.0
**日期：** 2026-04-21
**状态：** 已确认

---

## 一、概述

行程生成模块是整个产品的核心。系统接收用户的行程参数（目的地、天数、偏好），通过 AI 模型生成结构化的每日行程安排。

### 1.1 AI 生成 vs 模板兜底

| 场景 | 处理方式 |
|---|---|
| AI 服务正常 | 使用 AI 生成行程 |
| AI 服务超时（> 10s） | 回退到预设模板 |
| AI 服务报错 | 回退到预设模板 |
| 目的地无 POI 数据 | 展示空结果页 |

### 1.2 AI 模型选型

| 模型 | 适用场景 | 成本 | 延迟 |
|---|---|---|---|
| Claude 4 Sonnet | 行程生成（主力） | 中 | 低 |
| GPT-4o Mini | 行程生成（备选） | 低 | 低 |
| GPT-4o | 高复杂度行程 | 高 | 中 |

**策略：** 默认 Claude Sonnet，失败时切换 GPT-4o Mini，再次失败使用模板。

---

## 二、Prompt 设计

### 2.1 行程生成 Prompt

```
【角色】
你是一名资深旅游规划师，拥有丰富的中国旅游知识。你根据用户的需求，生成贴心、实用、不流水账的旅游行程。

【用户需求】
- 目的地：{{destinations}}
- 出发日期：{{start_date}}（周X）
- 游玩天数：{{days}}天
- 游玩方式：{{preferences}}
- 补充说明：{{extra_notes}}

【数据来源】
景点/餐厅/酒店信息来自高德地图POI数据：
{{poi_data}}

【输出要求】
1. 生成JSON数组，每一天是一个对象
2. 每天包含2-4个景点、1-2家餐厅、1家酒店
3. 相邻景点之间给出交通提示（步行X分钟/打车X分钟）
4. 每个景点给出游览时长建议
5. 餐厅给出推荐菜和人均消费
6. 住宿给出推荐理由
7. 不输出广告推销内容，只推荐真实体验好的地方
8. 总字数控制在500字以内/天（精简）
9. 用JSON格式输出，不要markdown代码块

【输出格式】
```json
[
  {
    "day": 1,
    "date": "2026-05-01",
    "items": [
      {
        "type": "spot",
        "name": "景点名",
        "address": "地址",
        "duration": "建议游览时长",
        "description": "一句话描述",
        "transport_to_next": "到下一个景点的交通"
      },
      {
        "type": "food",
        "name": "餐厅名",
        "address": "地址",
        "budget": "人均X元",
        "recommend": "推荐菜1、推荐菜2"
      },
      {
        "type": "hotel",
        "name": "酒店名",
        "address": "地址",
        "budget": "X-Y元/晚",
        "reason": "推荐理由"
      }
    ]
  }
]
```
```

### 2.2 Prompt 变量注入

| 变量 | 来源 | 说明 |
|---|---|---|
| destinations | 用户输入 | 目的地名称列表 |
| start_date | 用户输入 | YYYY-MM-DD 格式 |
| days | 用户输入 | 整数 |
| preferences | 用户输入 | 游玩方式标签数组 |
| extra_notes | 用户输入 | 补充说明文本 |
| poi_data | 高德 API | 结构化的 POI 数据 |

### 2.3 随机玩目的地推荐 Prompt

```
【角色】
你是一名熟悉中国旅游的行程规划师，根据用户的位置、预算、天数和偏好，推荐最合适的旅游目的地。

【用户需求】
- 当前位置：{{current_location}}
- 出行天数：{{days}}天
- 人均预算：{{budget}}
- 偏好方式：{{preferences}}

【候选目的地池（预筛选过的）】
{{destination_pool}}

【输出要求】
1. 从候选池中选出最符合条件的前3个目的地
2. 每个目的地给出：
   - 名称、与出发地距离
   - 推荐理由（一句话）
   - 适合的天数
   - 预算是否匹配
   - 主要游玩标签
3. 优先推荐自驾/高铁可达的目的地
4. 用JSON格式输出

【输出格式】
```json
{
  "recommendations": [
    {
      "rank": 1,
      "destination": {
        "name": "目的地图",
        "province": "省份",
        "distance": "XXkm",
        "avg_budget": "参考消费",
        "tags": ["标签1", "标签2"],
        "summary": "推荐理由一句话"
      },
      "trip_preview": {
        "days": 适合天数,
        "spot_count": 预计景点数,
        "food_count": 预计餐饮数,
        "budget_range": "预算区间"
      }
    }
  ]
}
```
```

---

## 三、生成流程

```
用户提交请求
    │
    ▼
参数校验
    │
    ▼
查询 POI 数据（高德 API）
    │
    ▼
组装 Prompt
    │
    ▼
调用 AI 模型（超时10s）
    │
    ├── 成功 → JSON 解析 → 格式校验
    │              │
    │              ▼
    │         通过 → 返回前端
    │              │
    │              ▼
    │         不通过 → 记录错误日志 → 回退模板
    │
    └── 失败/超时 → 回退到预设模板
```

---

## 四、容错与降级

### 4.1 AI 服务降级策略

```
Level 0: 尝试 Claude Sonnet
    │
    ├── 成功 → 返回
    │
    └── 失败 → 等待100ms，重试 Claude Sonnet（最多2次）
                │
                ├── 成功 → 返回
                │
                └── 仍失败 → 切换 GPT-4o Mini
                              │
                              ├── 成功 → 返回
                              │
                              └── 失败 → 等待100ms，重试（最多2次）
                                            │
                                            ├── 成功 → 返回
                                            │
                                            └── 仍失败 → 回退到预设模板
```

### 4.2 预设模板策略

每个热门城市预置一套默认行程模板（由人工审核）：

**模板数据结构：**
```json
{
  "destination": "成都市",
  "template": [
    {
      "day": 1,
      "items": [
        { "type": "spot", "name": "宽窄巷子", "duration": "2小时", "description": "..." },
        { "type": "food", "name": "龙抄手", "budget": "人均50元", "recommend": "..." },
        { "type": "hotel", "name": "亚朵酒店", "budget": "400-600元/晚", "reason": "..." }
      ]
    }
  ]
}
```

当目的地无 POI 或 AI 生成失败时，替换目的地名称后直接返回模板。

### 4.3 错误日志

每次 AI 调用失败记录：
```json
{
  "timestamp": "2026-04-21T10:00:00Z",
  "error_type": "timeout|parse_error|provider_error",
  "model": "claude-sonnet-4",
  "destinations": ["成都市"],
  "days": 3,
  "error_message": "...",
  "request_duration_ms": 10500
}
```

日志用于后续优化 Prompt 和监控模型质量。

---

## 五、POI 数据注入策略

### 5.1 POI 收集顺序

对于每个目的地，按以下顺序收集 POI：

```
1. 景点 POI（type=风景名胜，keyword=目的地名称）
2. 餐厅 POI（type=餐饮服务，keyword=目的地美食/小吃）
3. 酒店 POI（type=住宿服务，keyword=目的地酒店，sort=价格适中）
```

### 5.2 POI 数据裁剪

为控制 Prompt Token 消耗，对 POI 数据做精简：

| 字段 | 是否传入 Prompt | 说明 |
|---|---|---|
| name | ✅ | 必须 |
| address | ✅ | 必须 |
| location | ✅ | 必须（用于交通衔接计算） |
| rating | ✅ | 必须（>4.0优先） |
| tag | ✅ | 必须（匹配用户偏好） |
| open_time | ❌ | 不传入 |
| tel | ❌ | 不传入 |
| price | ✅ | 仅酒店需要 |

### 5.3 Token 预算

| 模型 | 单次最大 Token | 单次行程生成预算 |
|---|---|---|
| Claude Sonnet | 200K | 8K（Prompt）+ 2K（输出） |
| GPT-4o Mini | 128K | 6K（Prompt）+ 1.5K（输出） |

---

## 六、质量评估

### 6.1 自动评估指标

| 指标 | 定义 | 目标值 |
|---|---|---|
| 生成成功率 | AI 成功生成 / 总请求数 | > 95% |
| 平均响应时间 | 从发请求到收到响应 | < 5s（p95 < 10s） |
| 格式正确率 | JSON 解析成功 / 成功生成数 | > 99% |
| 模板回退率 | 使用兜底模板 / 总请求数 | < 5% |

### 6.2 人工抽检

每周随机抽 20 条行程由运营人员评估：
- 内容是否真实存在
- 是否符合用户偏好
- 是否有广告感
- 每日景点数量是否合理（2-4个为佳）

抽检结果反馈到 Prompt 优化。

---

## 七、推荐算法（随机玩）

### 7.1 目的地候选池

预置 200 个热门目的地，每个目的地包含：

```json
{
  "name": "都江堰市",
  "province": "四川省",
  "city": "成都市",
  "latitude": 30.9872,
  "longitude": 103.6123,
  "avg_budget": 800,
  "tags": ["自然风光", "世界遗产", "轻松度假"],
  "transport_mode": "car",  // car | highspeed | plane
  "max_days": 3
}
```

### 7.2 推荐评分公式

```
Score = Distance_Score × 0.3
      + Budget_Score × 0.3
      + Tag_Score × 0.4

Distance_Score = 1 - (distance / max_distance)，距离越近分数越高
Budget_Score = 1 - abs(avg_budget - user_budget) / user_budget，预算越匹配分数越高
Tag_Score = 匹配的偏好标签数量 / 总偏好标签数量
```

### 7.3 距离计算

使用 Haversine 公式计算两点间球面距离：

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
c = 2 × atan2(√a, √(1-a))
d = R × c  (R = 6371km)
```

### 7.4 半衰期更新

候选目的地池中每个目的地的 avg_budget 和 tags 由运营人员定期更新。

---

## 八、未来优化方向

### 8.1 v2.0：用户行为驱动优化

- 记录用户对行程中各项的「隐藏/删除」操作
- 删除率高的 POI 降低推荐权重
- 高打开率的行程特征用于训练 Fine-tuning 数据集

### 8.2 v3.0：Embedding 相似度召回

- 将目的地描述 + 用户偏好文本向量化（text-embedding-3-small）
- 用向量数据库（Milvus/Pinecone）做语义检索
- 突破关键词匹配的局限性
