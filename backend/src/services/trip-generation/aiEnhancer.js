import { aiGenerator as defaultAiGenerator } from '../../ai/generator.js';

export class TripAIEnhancer {
  constructor({ aiGenerator = defaultAiGenerator } = {}) {
    this.aiGenerator = aiGenerator;
  }

  async enhance({ request, skeleton, candidates }) {
    if (process.env.SKIP_AI === 'true') {
      return { skipped: true, reason: 'ai_skipped' };
    }

    const itinerary = await this.aiGenerator.enhanceTripSkeleton({
      request,
      skeleton,
      candidates
    });

    return Array.isArray(itinerary) ? { itinerary, warnings: [] } : itinerary;
  }
}
