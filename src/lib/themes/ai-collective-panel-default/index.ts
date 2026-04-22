import Theme from './Theme.svelte';
import backgroundImageUrl from './assets/default-thumbnail-bg.png';
import eventLogoUrl from './assets/HumanX-white-logo-cropped.png';
import fallbackLogoUrl from './assets/AIC-Logo-White-cropped.png';
import wordmarkUrl from './assets/Wordmark-White.png';
import { buildAiCollectiveDefaults, DEFAULT_BACKGROUND_URL_LEGACY, DEFAULT_EVENT_LOGO_URL_LEGACY } from './defaults';
import type { ThumbnailThemeDefinition } from '$lib/types';
import './theme.css';

export const assets = {
	backgroundImageUrl,
	eventLogoUrl,
	fallbackLogoUrl,
	wordmarkUrl
};

export const theme: ThumbnailThemeDefinition = {
	meta: {
		id: 'ai-collective-panel-default',
		name: 'AI Collective Panel Default',
		description: 'Editorial panel layout derived from the original enterprise test mockup.',
		order: 10
	},
	component: Theme,
	defaults: (event) => ({
		...buildAiCollectiveDefaults(event),
		backgroundImageUrl,
		eventLogoUrl
	}),
	editor: {
		eventFields: ['variantLabel', 'eyebrow'],
		brandingFields: ['backgroundImageUrl', 'eventLogoUrl', 'producerCredit', 'ctaText'],
		personFields: ['role', 'name', 'company', 'photoUrl', 'companyLogoUrl', 'photoPosition', 'logoScale']
	},
	assets,
	legacyAssetUrls: {
		[DEFAULT_BACKGROUND_URL_LEGACY]: backgroundImageUrl,
		[DEFAULT_EVENT_LOGO_URL_LEGACY]: eventLogoUrl
	}
};
