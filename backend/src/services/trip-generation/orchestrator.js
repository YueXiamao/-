import { normalizeGenerateTripRequest } from './requestNormalizer.js';
import { Errors } from '../../middleware/errorHandler.js';

export function createGenerationMeta(overrides = {}) {
  const warnings = Array.isArray(overrides.warnings) ? overrides.warnings : [];

  return {
    phase: 'ready',
    warnings,
    ...overrides,
    warnings
  };
}

function normalizeGeneration(result) {
  if (Array.isArray(result)) {
    return { itinerary: result, warnings: [] };
  }

  return result && typeof result === 'object'
    ? { ...result, warnings: Array.isArray(result.warnings) ? result.warnings : [] }
    : { itinerary: null, warnings: [] };
}

function hasUsableItems(day) {
  return day && typeof day === 'object' && Array.isArray(day.items) && day.items.length > 0;
}

function hasUsableItinerary(itinerary, expectedDays) {
  return Array.isArray(itinerary)
    && itinerary.length === expectedDays
    && itinerary.every(hasUsableItems);
}

function buildRetryableGenerationError() {
  const failure = Errors.INTERNAL_ERROR('trip_generation_failed');
  failure.statusCode = 503;
  failure.retryable = true;
  return failure;
}

function timeoutAfter(ms, reason) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ skipped: true, reason }), ms);
  });
}

export class TripGenerationOrchestrator {
  constructor({
    tripService,
    candidateService,
    skeletonBuilder,
    fallbackTemplateProvider,
    aiEnhancer,
    resultValidator,
    enhancementTimeoutMs = 18000
  }) {
    this.tripService = tripService;
    this.candidateService = candidateService;
    this.skeletonBuilder = skeletonBuilder;
    this.fallbackTemplateProvider = fallbackTemplateProvider;
    this.aiEnhancer = aiEnhancer;
    this.resultValidator = resultValidator;
    this.enhancementTimeoutMs = enhancementTimeoutMs;
  }

  async generate(input) {
    const request = normalizeGenerateTripRequest(input);
    const candidates = await this.candidateService.prepare(request);
    let generation = null;
    let templateReason = null;

    try {
      generation = normalizeGeneration(await this.skeletonBuilder.build(request, candidates));
      if (!this.isValidItinerary(generation.itinerary, request.days).valid) {
        templateReason = 'invalid_rule_based_itinerary';
      }
    } catch (error) {
      templateReason = 'skeleton_builder_failed';
    }

    if (!templateReason) {
      const enhanced = await this.tryEnhancement(request, candidates, generation);

      if (enhanced.accepted) {
        return this.tripService.buildGeneratedTripResponse(request, {
          source: 'ai_enhanced',
          fallback_level: 'none',
          generation_meta: createGenerationMeta({
            phase: 'ready',
            used_ai: true,
            warnings: enhanced.warnings
          }),
          itinerary: enhanced.itinerary
        });
      }

      return this.tripService.buildGeneratedTripResponse(request, {
        source: 'rule_based',
        fallback_level: 'rule_based',
        generation_meta: createGenerationMeta({
          phase: 'degraded',
          used_ai: false,
          warnings: [...(generation?.warnings || []), ...enhanced.warnings]
        }),
        itinerary: generation.itinerary
      });
    }

    let templateGeneration;
    try {
      templateGeneration = normalizeGeneration(this.fallbackTemplateProvider.provide(request, {
        reason: templateReason
      }));
    } catch (error) {
      throw buildRetryableGenerationError();
    }

    if (!this.isValidItinerary(templateGeneration.itinerary, request.days).valid) {
      throw buildRetryableGenerationError();
    }

    return this.tripService.buildGeneratedTripResponse(request, {
      source: 'fallback_template',
      fallback_level: 'template',
      generation_meta: createGenerationMeta({
        phase: 'degraded',
        used_ai: false,
        warnings: templateGeneration.warnings
      }),
      itinerary: templateGeneration.itinerary
    });
  }

  async tryEnhancement(request, candidates, generation) {
    if (!this.aiEnhancer || !this.resultValidator) {
      return { accepted: false, warnings: [] };
    }

    try {
      const enhancedGeneration = await Promise.race([
        this.aiEnhancer.enhance({
          request,
          skeleton: generation.itinerary,
          candidates
        }),
        timeoutAfter(this.enhancementTimeoutMs, 'ai_enhancement_timeout')
      ]);

      if (!enhancedGeneration || enhancedGeneration.skipped) {
        return {
          accepted: false,
          warnings: [enhancedGeneration?.reason || 'ai_skipped']
        };
      }

      const normalized = normalizeGeneration(enhancedGeneration);
      const validation = this.resultValidator.validate(normalized.itinerary, {
        expectedDays: request.days,
        baselineItinerary: generation.itinerary
      });

      if (!validation.valid) {
        return { accepted: false, warnings: ['ai_result_rejected'] };
      }

      return {
        accepted: true,
        itinerary: normalized.itinerary,
        warnings: normalized.warnings
      };
    } catch (error) {
      return { accepted: false, warnings: ['ai_enhancement_failed'] };
    }
  }

  isValidItinerary(itinerary, expectedDays) {
    if (this.resultValidator) {
      return this.resultValidator.validate(itinerary, { expectedDays });
    }

    const valid = hasUsableItinerary(itinerary, expectedDays);
    return {
      valid,
      severity: valid ? 'none' : 'error',
      issues: []
    };
  }
}
