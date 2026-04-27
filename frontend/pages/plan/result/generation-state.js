const BANNER_TEXT = {
  rule_based: '已先为你生成一版可编辑行程，景点数据较少或 AI 未完成时也可以继续调整。',
  template: '当前目的地可用数据较少，已先生成参考行程，可继续编辑完善。'
};

const BANNER_LABEL = {
  rule_based: '可编辑行程',
  template: '参考行程'
};

export function normalizeGenerationState(trip = {}) {
  const fallbackLevel = trip.fallback_level || 'none';
  const metaPhase = trip.generation_meta?.phase;
  const source = trip.source || '';
  const phase = metaPhase || (source === 'ai_enhanced' || fallbackLevel === 'none' ? 'ready' : 'degraded');
  const isDegraded = phase === 'degraded' || fallbackLevel !== 'none';

  return {
    phase: isDegraded ? 'degraded' : 'ready',
    fallbackLevel,
    isDegraded,
    bannerLabel: isDegraded ? (BANNER_LABEL[fallbackLevel] || BANNER_LABEL.rule_based) : '',
    bannerText: isDegraded ? (BANNER_TEXT[fallbackLevel] || BANNER_TEXT.rule_based) : ''
  };
}
