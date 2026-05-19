import { DEFAULT_CTA_TEXT, DEFAULT_PRODUCER_CREDIT } from '$lib/constants';
import type { EventSource, ThumbnailConfig } from '$lib/types';

export function buildSfDemoNightDefaults(
	_event: EventSource
): Partial<ThumbnailConfig> {
	return {
		producerCredit: DEFAULT_PRODUCER_CREDIT,
		ctaText: DEFAULT_CTA_TEXT
	};
}
