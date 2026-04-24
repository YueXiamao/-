import { normalizeGenerateTripRequest } from './requestNormalizer.js';

export function createGenerationMeta(overrides = {}) {
  const warnings = Array.isArray(overrides.warnings) ? overrides.warnings : [];

  return {
    phase: 'ready',
    warnings,
    ...overrides,
    warnings
  };
}

export class TripGenerationOrchestrator {
  constructor({
    tripService,
    candidateService,
    skeletonBuilder,
    aiEnhancer,
    resultValidator,
    fallbackTemplateProvider
  }) {
    this.tripService = tripService;
    this.candidateService = candidateService;
    this.skeletonBuilder = skeletonBuilder;
    this.aiEnhancer = aiEnhancer;
    this.resultValidator = resultValidator;
    this.fallbackTemplateProvider = fallbackTemplateProvider;
  }

  async generate(input) {
    const request = normalizeGenerateTripRequest(input);
    const candidates = await this.candidateService.prepare(request);
    const skeleton = await this.skeletonBuilder.build(request, candidates);
    const generation = Array.isArray(skeleton)
      ? { itinerary: skeleton, warnings: [] }
      : (skeleton || {});

    let itinerary = generation?.itinerary;
    if (typeof this.resultValidator?.validate === 'function') {
      itinerary = this.resultValidator.validate(itinerary, request, generation);
    }

    if (!Array.isArray(itinerary)) {
      itinerary = this.fallbackTemplateProvider.get(
        request.destinations,
        request.days,
        request.start_date
      );
    }

    return this.tripService.buildGeneratedTripResponse(request, {
      source: 'rule_based',
      fallback_level: 'rule_based',
      generation_meta: createGenerationMeta({
        phase: 'degraded',
        warnings: generation?.warnings || []
      }),
      itinerary
    });
  }
}
