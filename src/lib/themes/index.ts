import type { ThumbnailThemeDefinition } from '$lib/types';

type ThemeModule = {
	theme: ThumbnailThemeDefinition;
};

const themeModules = import.meta.glob<ThemeModule>('./*/index.ts', {
	eager: true
});

export const thumbnailThemes = Object.values(themeModules)
	.map((module) => module.theme)
	.sort((left, right) => {
		const leftOrder = left.meta.order ?? Number.MAX_SAFE_INTEGER;
		const rightOrder = right.meta.order ?? Number.MAX_SAFE_INTEGER;

		if (leftOrder !== rightOrder) {
			return leftOrder - rightOrder;
		}

		return left.meta.name.localeCompare(right.meta.name);
	});

export const DEFAULT_THEME_ID = thumbnailThemes[0]?.meta.id ?? '';

export function getThemeById(themeId: string) {
	return thumbnailThemes.find((theme) => theme.meta.id === themeId) ?? thumbnailThemes[0];
}

export function getThemeLegacyAssetUrlMap() {
	return thumbnailThemes.reduce<Record<string, string>>((map, theme) => {
		for (const [legacyUrl, resolvedUrl] of Object.entries(theme.legacyAssetUrls ?? {})) {
			map[legacyUrl] = resolvedUrl;
		}

		return map;
	}, {});
}
