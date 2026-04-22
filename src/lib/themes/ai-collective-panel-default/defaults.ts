import { DEFAULT_CTA_TEXT, DEFAULT_PRODUCER_CREDIT } from '$lib/constants';
import type { EventSource, ThumbnailConfig } from '$lib/types';

export const DEFAULT_EVENT_LOGO_URL_LEGACY = '/HumanX-white-logo-cropped.png';
export const DEFAULT_BACKGROUND_URL_LEGACY = '/default-thumbnail-bg.png';

export function buildAiCollectiveDefaults(
	_event: EventSource
): Partial<ThumbnailConfig> {
	return {
		producerCredit: DEFAULT_PRODUCER_CREDIT,
		ctaText: DEFAULT_CTA_TEXT
	};
}
