import { thumbnailThemes } from '$lib/themes';

const WSERV_BASE_URL = 'https://wsrv.nl/';

function hasValue(value: string) {
	return value.trim().length > 0;
}

function isRemoteHttpUrl(value: string) {
	return /^https?:\/\//i.test(value.trim());
}

function isAlreadyProxied(url: string) {
	return /^https:\/\/wsrv\.nl\/\?url=/i.test(url.trim());
}

function isSameOriginOrLocalUrl(value: string) {
	const trimmed = value.trim();

	try {
		const parsed = new URL(trimmed);

		if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
			return true;
		}

		return (
			parsed.hostname === 'localhost' ||
			parsed.hostname === '127.0.0.1' ||
			parsed.hostname === '0.0.0.0' ||
			parsed.hostname === '[::1]'
		);
	} catch {
		return false;
	}
}

function buildProxyUrl(url: string) {
	return `${WSERV_BASE_URL}?url=${encodeURIComponent(url.trim())}`;
}

export function shouldProxyThemeImage(url: string, themeId: string) {
	const theme = thumbnailThemes.find((entry) => entry.meta.id === themeId);

	if (!theme?.requiresImageProxy) {
		return false;
	}

	if (
		!hasValue(url) ||
		!isRemoteHttpUrl(url) ||
		isAlreadyProxied(url) ||
		isSameOriginOrLocalUrl(url)
	) {
		return false;
	}

	return true;
}

export function resolveRenderableImageUrl(url: string, themeId: string) {
	if (!shouldProxyThemeImage(url, themeId)) {
		return url;
	}

	return buildProxyUrl(url);
}
