import type { EventSource, ThumbnailConfig } from '$lib/types';

export const DEFAULT_PRODUCER_CREDIT = 'KROK PRODUCTIONS by Data Phoenix';
export const DEFAULT_CTA_TEXT = 'Watch Now';

export function buildDataPhoenixDefaults(
	_event: EventSource
): Partial<ThumbnailConfig> {
	return {
		producerCredit: DEFAULT_PRODUCER_CREDIT,
		ctaText: DEFAULT_CTA_TEXT,
		backgroundImageUrl: '',
		eventLogoUrl: ''
	};
}
