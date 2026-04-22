import Theme from './Theme.svelte';
import backgroundImageUrl from './assets/ai-collective-background.png';
import eventLogoUrl from './assets/HumanX-white-logo-cropped.png';
import wordmarkUrl from './assets/Wordmark-White.png';
import { buildAiCollectiveDefaults, DEFAULT_BACKGROUND_URL_LEGACY, DEFAULT_EVENT_LOGO_URL_LEGACY } from './defaults';
import type { ThumbnailThemeDefinition } from '$lib/types';
import './theme.css';

export const assets = {
	backgroundImageUrl,
	eventLogoUrl,
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
	requiresImageProxy: true,
	defaults: (event) => {
		const base = buildAiCollectiveDefaults(event);
		const createId = (role: string, i: number) => `${event.id}-${role}-${i + 1}`;

		return {
			...base,
			backgroundImageUrl,
			eventLogoUrl,
			people: [
				...event.moderators.map((m, i) => ({
					id: createId('moderator', i),
					role: 'Moderator',
					name: m.name.toUpperCase(),
					company: m.company,
					photoUrl: m.photo_url,
					companyLogoUrl: m.company_logo_url || '',
					photoPositionX: 50,
					photoPositionY: 50,
					logoScale: 100
				})),
				...event.confirmed_speakers.map((s, i) => ({
					id: createId('panelist', i),
					role: 'Panelist',
					name: s.name.toUpperCase(),
					company: s.company,
					photoUrl: s.photo_url,
					companyLogoUrl: s.company_logo_url || '',
					photoPositionX: 50,
					photoPositionY: 50,
					logoScale: 100
				}))
			]
		};
	},
	editor: {
		brandingFields: ['eventLogoUrl', 'producerCredit', 'ctaText'],
		personFields: ['role', 'name', 'company', 'photoUrl', 'companyLogoUrl', 'photoPosition', 'logoScale']
	},
	assets,
	legacyAssetUrls: {
		[DEFAULT_BACKGROUND_URL_LEGACY]: backgroundImageUrl,
		[DEFAULT_EVENT_LOGO_URL_LEGACY]: eventLogoUrl
	}
};
