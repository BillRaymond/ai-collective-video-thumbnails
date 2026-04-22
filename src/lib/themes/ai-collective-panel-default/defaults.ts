import type { EventSource, ThumbnailConfig } from '$lib/types';

export const DEFAULT_EVENT_LOGO_URL_LEGACY = '/HumanX-white-logo-cropped.png';
export const DEFAULT_BACKGROUND_URL_LEGACY = '/default-thumbnail-bg.png';
export const DEFAULT_PRODUCER_CREDIT = 'KROK PRODUCTIONS by Data Phoenix';
export const DEFAULT_CTA_TEXT = 'Watch Now';
export const DEFAULT_VARIANT_LABEL = 'Panel Discussion';
export const DEFAULT_EYEBROW_SUFFIX = 'The AI Collective';

export function buildAiCollectiveDefaults(
	event: EventSource
): Partial<Omit<ThumbnailConfig, 'templateId' | 'people'>> {
	return {
		variantLabel: DEFAULT_VARIANT_LABEL,
		eyebrow:
			event.day !== undefined && event.day !== null && event.day !== ''
				? `Day ${event.day} · ${DEFAULT_EYEBROW_SUFFIX}`
				: DEFAULT_EYEBROW_SUFFIX,
		producerCredit: DEFAULT_PRODUCER_CREDIT,
		ctaText: DEFAULT_CTA_TEXT
	};
}
