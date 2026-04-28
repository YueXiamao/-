// ─── POI 类型枚举 ──────────────────────────────────────────────────────────
const POI_TYPES = ['spot', 'attraction', 'food', 'hotel', 'transport', 'shopping', 'entertainment'];

// 各类 POI 的必填（required）/ 选填（optional）字段规范
// 用于 AI 增强结果校验和数据库写入前的校验
const FIELD_SPEC = {
  // 景点：必须有名称、类型
  spot: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes', 'rating', 'confidence_level', 'image_url', 'tags']
  },
  // 景点：必须有名称、类型
  attraction: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes', 'rating', 'confidence_level', 'image_url', 'tags']
  },
  // 美食：必须有名称、类型，可选推荐理由
  food: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes', 'rating', 'confidence_level', 'image_url', 'tags']
  },
  // 住宿：必须有名称、类型
  hotel: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes', 'rating', 'confidence_level', 'image_url', 'tags']
  },
  // 交通：必须有类型、名称（或描述）
  transport: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes']
  },
  // 购物：必须有名称、类型
  shopping: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes', 'rating', 'confidence_level', 'image_url', 'tags']
  },
  // 娱乐：必须有名称、类型
  entertainment: {
    required: ['type', 'name'],
    optional: ['address', 'description', 'duration', 'budget', 'recommend', 'reason',
                'transport_to_next', 'notes', 'rating', 'confidence_level', 'image_url', 'tags']
  },
};

export { POI_TYPES, FIELD_SPEC };

const PRODUCT_FIELD_NAMES = [
  'summary', 'name', 'address', 'description', 'duration', 'budget',
  'recommend', 'reason', 'transport_to_next', 'notes'
];

const CHINESE_NARRATIVE_FIELD_NAMES = [
  'summary', 'description', 'recommend', 'reason', 'transport_to_next', 'notes'
];

const POLLUTED_PATTERNS = [
  /\[object Object\]/i, /\bundefined\b/i, /\bnull\b/i,
  /\b暂无评分\s*[\d.]+\b/i,  // 拒绝 "暂无评分 5.0" 这类伪造评分
];

const INTERNAL_PATTERNS = [
  /\brule[_ -]?based\b/i, /\bfallback\b/i, /\btemplate[_ -]?fallback\b/i,
  /\bplaceholder\b/i, /\bai[_ -]?result[_ -]?rejected\b/i,
  /\bai[_ -]?enhancement[_ -]?failed\b/i, /\bai[_ -]?skipped\b/i,
  /\bskeleton[_ -]?builder[_ -]?failed\b/i, /\binvalid[_ -]?rule[_ -]?based[_ -]?itinerary\b/i
];

function getItinerary(result) {
  return Array.isArray(result) ? result : result?.itinerary;
}

function issue(code, path, severity = 'error') {
  return { code, path, severity };
}

function hasPollutedText(value) {
  return typeof value === 'string'
    && POLLUTED_PATTERNS.some(p => p.test(value));
}

function hasInternalText(value) {
  return typeof value === 'string'
    && INTERNAL_PATTERNS.some(p => p.test(value));
}

function hasEnglishNarrativeText(fieldName, value) {
  return CHINESE_NARRATIVE_FIELD_NAMES.includes(fieldName)
    && typeof value === 'string'
    && /[A-Za-z]{2,}/.test(value);
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// ─── 校验 POI 可信字段 ─────────────────────────────────────────────────────

/**
 * 校验单个 POI item 的可信字段规范
 * - confidence_level 必须是 verified | estimated | ai_suggested 其一
 * - rating 存在时必须与 confidence_level=verified 对应
 * - 不允许出现 "暂无评分 X.X" 格式的文本
 */
function validateItemConfidence(item, itemPath, issues) {
  const validLevels = ['verified', 'estimated', 'ai_suggested'];

  if (item.confidence_level && !validLevels.includes(item.confidence_level)) {
    issues.push(issue('invalid_confidence_level', `${itemPath}.confidence_level`));
  }

  // rating 存在时，confidence_level 不应该是 estimated（真实数据应该是 verified）
  if (item.rating != null && item.confidence_level === 'estimated') {
    issues.push(issue('rating_with_estimated', `${itemPath}.rating`));
  }

  // 校验字段：AI 生成的 item 必须有 confidence_level 标记
  if (item.source === 'ai_suggested' && !item.confidence_level) {
    issues.push(issue('missing_confidence_level', `${itemPath}.confidence_level`));
  }
}

export class TripResultValidator {
  validate(result, { expectedDays, baselineItinerary } = {}) {
    const itinerary = getItinerary(result);
    const issues = [];

    if (!Array.isArray(itinerary)) {
      issues.push(issue('missing_itinerary', 'itinerary'));
      return this.report(issues);
    }

    if (Number.isInteger(expectedDays) && itinerary.length !== expectedDays) {
      issues.push(issue('day_count_mismatch', 'itinerary'));
    }

    itinerary.forEach((day, dayIndex) => {
      const dayPath = `itinerary[${dayIndex}]`;
      const baselineDay = Array.isArray(baselineItinerary) ? baselineItinerary[dayIndex] : null;

      if (!day || typeof day !== 'object') {
        issues.push(issue('missing_day', dayPath));
        return;
      }

      if (baselineDay) {
        if (day.day !== baselineDay.day) issues.push(issue('day_number_changed', `${dayPath}.day`));
        if (day.date !== baselineDay.date) issues.push(issue('day_date_changed', `${dayPath}.date`));
      }

      if (!Array.isArray(day.items) || day.items.length === 0) {
        issues.push(issue('empty_day_items', `${dayPath}.items`));
        return;
      }

      day.items.forEach((item, itemIndex) => {
        const itemPath = `${dayPath}.items[${itemIndex}]`;
        const baselineItem = baselineDay?.items?.[itemIndex];

        if (!item || typeof item !== 'object') {
          issues.push(issue('missing_item', itemPath));
          return;
        }

        if (!item.type || typeof item.type !== 'string') {
          issues.push(issue('missing_item_type', `${itemPath}.type`));
        } else if (!POI_TYPES.includes(item.type)) {
          issues.push(issue('unknown_item_type', `${itemPath}.type`, 'warning'));
        } else {
          const spec = FIELD_SPEC[item.type];
          if (spec) {
            for (const reqField of spec.required) {
              if (!item[reqField] || typeof item[reqField] !== 'string' || item[reqField].trim() === '') {
                issues.push(issue('missing_required_field', `${itemPath}.${reqField}`, 'error'));
              }
            }
          }
        }

        if (!item.name || typeof item.name !== 'string') {
          issues.push(issue('missing_item_name', `${itemPath}.name`));
        }

        validateItemConfidence(item, itemPath, issues);

        if (baselineItem?.type && item.type !== baselineItem.type) {
          issues.push(issue('item_type_changed', `${itemPath}.type`));
        }
        if (baselineItem?.name && item.name !== baselineItem.name) {
          issues.push(issue('item_name_changed', `${itemPath}.name`));
        }
        if (baselineItem?.address && item.address !== baselineItem.address) {
          issues.push(issue('item_address_changed', `${itemPath}.address`));
        }

        this.validateTextFields(item, itemPath, issues, baselineItem);
      });
    });

    return this.report(issues);
  }

  validateItemConfidence(container, basePath, issues) {
    for (const fieldName of PRODUCT_FIELD_NAMES) {
      if (!(fieldName in container)) continue;
      const value = container[fieldName];
      const path = `${basePath}.${fieldName}`;
      if (hasPollutedText(value)) issues.push(issue('polluted_text', path));
      if (hasInternalText(value)) issues.push(issue('internal_text', path));
      if (hasEnglishNarrativeText(fieldName, value)) issues.push(issue('english_narrative_text', path));
    }
  }

  validateTextFields(container, basePath, issues, baselineContainer = null) {
    // 检测是否移除了必填字段
    if (baselineContainer) {
      for (const fieldName of PRODUCT_FIELD_NAMES) {
        if (hasNonEmptyString(baselineContainer[fieldName])
          && !hasNonEmptyString(container[fieldName])) {
          issues.push(issue('removed_product_field', `${basePath}.${fieldName}`));
        }
      }
    }
    // 污染文本和内部文本检测
    this.validateItemConfidence(container, basePath, issues);
  }

  report(issues) {
    return {
      valid: issues.length === 0,
      severity: issues.length === 0 ? 'none' : 'error',
      issues
    };
  }
}
