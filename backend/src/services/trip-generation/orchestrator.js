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

export class TripGenerationOrchestrator {
  constructor({
    tripService,
    candidateService,
    skeletonBuilder,
    fallbackTemplateProvider
  }) {
    this.tripService = tripService;
    this.candidateService = candidateService;
    this.skeletonBuilder = skeletonBuilder;
    this.fallbackTemplateProvider = fallbackTemplateProvider;
  }

  async generate(input) {
    const request = normalizeGenerateTripRequest(input);
    const candidates = await this.candidateService.prepare(request);
    let generation = null;
    let templateReason = null;

    try {
      generation = normalizeGeneration(await this.skeletonBuilder.build(request, candidates));
      if (!hasUsableItinerary(generation.itinerary, request.days)) {
        templateReason = 'invalid_rule_based_itinerary';
      }
    } catch (error) {
      templateReason = 'skeleton_builder_failed';
    }

    if (!templateReason) {
      return this.tripService.buildGeneratedTripResponse(request, {
        source: 'rule_based',
        fallback_level: 'rule_based',
        generation_meta: createGenerationMeta({
          phase: 'degraded',
          warnings: generation?.warnings || []
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

    if (!hasUsableItinerary(templateGeneration.itinerary, request.days)) {
      throw buildRetryableGenerationError();
    }

    return this.tripService.buildGeneratedTripResponse(request, {
      source: 'fallback_template',
      fallback_level: 'template',
      generation_meta: createGenerationMeta({
        phase: 'degraded',
        warnings: templateGeneration.warnings
      }),
      itinerary: templateGeneration.itinerary
    });
  }
}
