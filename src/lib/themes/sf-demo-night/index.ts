import Theme from './Theme.svelte';
import backgroundImageUrl from './assets/sf-demo-night-background.png';
import eventLogoUrl from './assets/HumanX-white-logo-cropped.png';
import wordmarkUrl from './assets/Wordmark-White.png';
import { buildSfDemoNightDefaults } from './defaults';
import type { ThumbnailThemeDefinition } from '$lib/types';
import './theme.css';

export const assets = {
	backgroundImageUrl,
	eventLogoUrl,
	wordmarkUrl
};

export const theme: ThumbnailThemeDefinition = {
	meta: {
		id: 'sf-demo-night',
		name: 'SF Demo Night',
		description: 'SF Demo Night layout using the AI Collective panel background.',
		order: 30
	},
	component: Theme,
	requiresImageProxy: true,
	defaults: (event) => {
		const base = buildSfDemoNightDefaults(event);
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
			'companyLogoHasBackground',
			'photoPosition',
			'logoScale'
		]
	},
	assets
};
