import type { EventSource, ThumbnailConfig } from '$lib/types';

export const DEFAULT_VARIANT_LABEL = 'Panel Discussion';
export const DEFAULT_PRODUCER_CREDIT = 'KROK PRODUCTIONS by Data Phoenix';
export const DEFAULT_CTA_TEXT = 'Watch Now';

export function buildDataPhoenixDefaults(
	_event: EventSource
): Partial<Omit<ThumbnailConfig, 'templateId' | 'people'>> {
	return {
		variantLabel: DEFAULT_VARIANT_LABEL,
		producerCredit: DEFAULT_PRODUCER_CREDIT,
		ctaText: DEFAULT_CTA_TEXT,
		eyebrow: '',
		backgroundImageUrl: '',
		eventLogoUrl: ''
	};
}
