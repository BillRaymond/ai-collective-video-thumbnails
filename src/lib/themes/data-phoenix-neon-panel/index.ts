import Theme from './Theme.svelte';
import backgroundImageUrl from './assets/data-phoenix-background.png';
import secondaryLogoUrl from './assets/AIC-Logo-White-cropped.png';
import { buildDataPhoenixDefaults } from './defaults';
import type { ThumbnailThemeDefinition } from '$lib/types';

export const assets = {
	backgroundImageUrl,
	secondaryLogoUrl
};

export const theme: ThumbnailThemeDefinition = {
	meta: {
		id: 'data-phoenix-neon-panel',
		name: 'Data Phoenix Neon Panel',
		description: 'Locked-background Data Phoenix session layout built around the original artwork.',
		order: 20
	},
	component: Theme,
	defaults: buildDataPhoenixDefaults,
	editor: {
		brandingFields: ['eventLogoUrl', 'producerCredit', 'ctaText'],
		personFields: ['role', 'name', 'company', 'photoUrl', 'photoPosition']
	},
	assets
};
