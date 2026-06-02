import Theme from './Theme.svelte';
import backgroundImageUrl from './assets/humans-in-ai-week-background.png';
import eventLogoUrl from './assets/HumanX-white-logo-cropped.png';
import {
	buildHumansInAiWeekDefaults,
	DEFAULT_BACKGROUND_URL_LEGACY,
	DEFAULT_EVENT_LOGO_URL_LEGACY
} from './defaults';
import type { ThumbnailThemeDefinition } from '$lib/types';
import './theme.css';

export const assets = {
	backgroundImageUrl,
	eventLogoUrl
};

export const theme: ThumbnailThemeDefinition = {
	meta: {
		id: 'humans-in-ai-week',
		name: 'Humans in AI Week',
		description: 'Light editorial AI Collective panel layout with fingerprint and signal-wave artwork.',
		order: 12
	},
	component: Theme,
	requiresImageProxy: true,
	defaults: (event) => {
		const base = buildHumansInAiWeekDefaults(event);
		const createId = (role: string, i: number) => `${event.id}-${role}-${i + 1}`;

		return {
			...base,
			backgroundImageUrl,
			eventLogoUrl,
			people: [
				...event.moderators.map((m, i) => ({
					id: createId('moderator', i),
					role: 'Moderator',
					name: m.name,
					company: m.company,
					photoUrl: m.photo_url,
					companyLogoUrl: m.company_logo_url || '',
					companyLogoHasBackground: false,
					photoPositionX: 50,
					photoPositionY: 50,
					logoScale: 100
				})),
				...event.confirmed_speakers.map((s, i) => ({
					id: createId('panelist', i),
					role: 'Panelist',
					name: s.name,
					company: s.company,
					photoUrl: s.photo_url,
					companyLogoUrl: s.company_logo_url || '',
					companyLogoHasBackground: false,
					photoPositionX: 50,
					photoPositionY: 50,
					logoScale: 100
				}))
			]
		};
	},
	editor: {
		brandingFields: ['eventLogoUrl', 'producerCredit', 'ctaText'],
		personFields: [
			'role',
			'name',
			'company',
			'photoUrl',
			'companyLogoUrl',
			'photoPosition',
			'logoScale'
		]
	},
	assets,
	legacyAssetUrls: {
		[DEFAULT_BACKGROUND_URL_LEGACY]: backgroundImageUrl,
		[DEFAULT_EVENT_LOGO_URL_LEGACY]: eventLogoUrl
	}
};
