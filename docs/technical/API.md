# API 接口文档

**版本：** v1.0
**日期：** 2026-04-21
**状态：** 已确认

---

## 一、接口概述

**Base URL：** `https://api.travel.com`（生产）
**测试 Base URL：** `https://test-api.travel.com`
**协议：** HTTPS
**数据格式：** JSON
**鉴权方式：** 微信小程序 OpenID（通过请求头 `X-OpenID` 传递，后端验证）

---

## 二、统一响应格式

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

### 错误响应

```json
{
  "code": 10001,
  "message": "参数校验失败",
  "errors": [
    { "field": "days", "message": "天数必须在1-14之间" }
  ]
}
```

### 错误码定义

| 错误码 | 说明 |
|---|---|
| 0 | 成功 |
| 10001 | 参数校验失败 |
| 10002 | 资源不存在 |
| 10003 | 权限不足 |
| 20001 | 高德 API 调用失败 |
| 20002 | AI 服务调用失败 |
| 20003 | 目的地数据为空 |
| 30001 | 服务器内部错误 |

---

## 三、行政区划接口

### 3.1 获取省份列表

```
GET /api/destinations/provinces
```

**响应：**
```json
{
  "code": 0,
  "data": [
    { "code": "510000", "name": "四川省" },
    { "code": "440000", "name": "广东省" }
  ]
}
```

### 3.2 获取地级市列表

```
GET /api/destinations/cities/:provinceCode
```

**参数（路径参数）：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| provinceCode | string | 是 | 省份代码，如 `510000` |

**响应：**
```json
{
  "code": 0,
  "data": [
    { "code": "510100", "name": "成都市" },
    { "code": "510300", "name": "攀枝花市" }
  ]
}
```

### 3.3 获取区县列表

```
GET /api/destinations/districts/:cityCode
```

**参数（路径参数）：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cityCode | string | 是 | 城市代码，如 `510100` |

**响应：**
```json
{
  "code": 0,
  "data": [
    { "code": "510104", "name": "锦江区" },
    { "code": "510105", "name": "青羊区" },
    { "code": "510116", "name": "双流区" },
    { "code": "510181", "name": "都江堰市" }
  ]
}
```

### 3.4 搜索目的地

```
GET /api/destinations/search?q=成都
```

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| q | string | 是 | 搜索关键词，最少2字 |
| limit | integer | 否 | 返回数量，默认10 |

**响应：**
```json
{
  "code": 0,
  "data": [
    { "code": "510100", "name": "成都市", "level": "city", "province": "四川省" },
    { "code": "510129", "name": "成都", "level": "district", "city": "大邑县" }
  ]
}
```

---

## 四、POI 查询接口

### 4.1 搜索 POI

```
POST /api/pois/search
Content-Type: application/json
X-OpenID: oxxxxxxx
```

**请求体：**
```json
{
  "keyword": "宽窄巷子",
  "type": "spot",
  "city": "成都市",
  "limit": 10
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| keyword | string | 是 | 搜索关键词 |
| type | string | 是 | spot / food / hotel |
| city | string | 是 | 所属城市 |
| limit | integer | 否 | 返回数量，默认10，最大50 |

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "poi_id": "B0FFFXXXXX",
      "name": "宽窄巷子",
      "address": "成都市青羊区长顺街附近",
      "location": { "lat": 30.6698, "lng": 104.0563 },
      "tel": "028-xxxx",
      "rating": 4.5,
      "tag": "历史文化街区",
      "open_time": "全天开放",
      "price": 0
    }
  ]
}
```

---

## 五、行程生成接口

### 5.1 生成行程

```
POST /api/trip/generate
Content-Type: application/json
X-OpenID: oxxxxxxx
```

**请求体：**
```json
{
  "destinations": [
    { "name": "成都市", "province": "四川省", "city": "成都市", "district": "" },
    { "name": "都江堰市", "province": "四川省", "city": "成都市", "district": "都江堰市" }
  ],
  "start_date": "2026-05-01",
  "days": 3,
  "preferences": ["轻松度假", "寻找美食"],
  "extra_notes": "想看日出，不吃辣"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "trip_id": "T20260421001",
    "title": "成都3日游",
    "destinations": ["成都市", "都江堰市"],
    "days": 3,
    "start_date": "2026-05-01",
    "itinerary": [
      {
        "day": 1,
        "date": "2026-05-01",
        "items": [
          {
            "type": "spot",
            "name": "宽窄巷子",
            "address": "成都市青羊区长顺街附近",
            "duration": "2小时",
            "description": "清代古街，体验成都慢生活",
            "transport_to_next": "步行10分钟"
          },
          {
            "type": "food",
            "name": "龙抄手（总店）",
            "address": "成都市锦江区城守街",
            "budget": "人均50元",
            "recommend": "红油抄手、赖汤圆"
          },
          {
            "type": "hotel",
            "name": "成都太古里春熙路亚朵酒店",
            "address": "成都市锦江区",
            "budget": "400-600元/晚",
            "reason": "位置好，步行可达太古里"
          }
        ]
      }
    ]
  }
}
```

### 5.2 保存行程

```
POST /api/trip/save
Content-Type: application/json
X-OpenID: oxxxxxxx
```

**请求体：** 同 5.1 的响应 data 结构（不含 trip_id）

### 5.3 获取用户行程列表

```
GET /api/trip/list?source=plan&page=1&page_size=10
X-OpenID: oxxxxxxx
```

### 5.4 获取行程详情

```
GET /api/trip/:trip_id
X-OpenID: oxxxxxxx
```

### 5.5 更新行程单项

```
PATCH /api/trip/:trip_id/item/:item_id
Content-Type: application/json
X-OpenID: oxxxxxxx
```

**请求体：**
```json
{
  "notes": "改到这里吃饭"
}
```

### 5.6 删除行程

```
DELETE /api/trip/:trip_id
X-OpenID: oxxxxxxx
```

### 5.7 导出行程（文字）

```
GET /api/trip/:trip_id/export
X-OpenID: oxxxxxxx
```

**响应：** 返回纯文本格式的行程，可直接复制

---

## 六、随机玩接口

### 6.1 推荐目的地

```
POST /api/discover/recommend
Content-Type: application/json
X-OpenID: oxxxxxxx
```

**请求体：**
```json
{
  "current_location": {
    "latitude": 30.5728,
    "longitude": 104.0668,
    "city": "成都市"
  },
  "days": 3,
  "budget": "1000-2000",
  "preferences": ["轻松度假", "网红打卡"]
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "recommendations": [
      {
        "rank": 1,
        "destination": {
          "name": "都江堰市",
          "province": "四川省",
          "city": "成都市",
          "distance": "55km",
          "avg_budget": "800元/人",
          "tags": ["自然风光", "世界遗产", "轻松度假"],
          "summary": "距离成都1小时车程的世界文化遗产，兼具自然风光与人文历史"
        },
        "trip_preview": {
          "days": 2,
          "spot_count": 4,
          "food_count": 3,
          "budget_range": "600-1000元/人"
        }
      }
    ]
  }
}
```

### 6.2 获取推荐目的地详情（转为行程规划）

```
POST /api/discover/:destination_name/trip
Content-Type: application/json
X-OpenID: oxxxxxxx
```

同 5.1 生成行程接口

---

## 七、用户偏好接口

### 7.1 上报偏好

```
POST /api/user/preference
Content-Type: application/json
X-OpenID: oxxxxxxx
```

**请求体：**
```json
{
  "destinations": ["成都市", "都江堰市"],
  "preferences": ["轻松度假", "寻找美食"],
  "extra_notes_keywords": ["日出", "不吃辣"]
}
```

### 7.2 获取用户偏好标签

```
GET /api/user/preference
X-OpenID: oxxxxxxx
```

---

## 八、微信相关接口

### 8.1 微信登录（获取 OpenID）

微信小程序通过 `wx.login()` 获取 code，后端用 code 换 openid：

```
POST /api/auth/login
Content-Type: application/json
```

**请求体：**
```json
{
  "code": "xxxxx"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "openid": "oxxxxxxxx",
    "is_new_user": true
  }
}
```

---

## 九、限流规则

| 接口 | 限流 |
|---|---|
| 公开接口（省份/城市列表） | 100次/分钟/IP |
| POI 搜索 | 50次/分钟/IP |
| 行程生成 | 10次/分钟/IP |
| 随机玩推荐 | 10次/分钟/IP |
| 用户操作类 | 无限制 |
