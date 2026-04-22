import type { EventSource, ThumbnailConfig } from '$lib/types';

export const DEFAULT_EVENT_LOGO_URL_LEGACY = '/HumanX-white-logo-cropped.png';
export const DEFAULT_BACKGROUND_URL_LEGACY = '/default-thumbnail-bg.png';
export const DEFAULT_PRODUCER_CREDIT = 'KROK PRODUCTIONS by Data Phoenix';
export const DEFAULT_CTA_TEXT = 'Watch Now';

export function buildAiCollectiveDefaults(
	_event: EventSource
): Partial<ThumbnailConfig> {
	return {
		producerCredit: DEFAULT_PRODUCER_CREDIT,
		ctaText: DEFAULT_CTA_TEXT
	};
}
