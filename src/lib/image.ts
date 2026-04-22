import { base } from '$app/paths';
import { thumbnailThemes } from '$lib/themes';

const WSERV_BASE_URL = 'https://wsrv.nl/';

function hasValue(value: string) {
	return value.trim().length > 0;
}

function isRemoteHttpUrl(value: string) {
	return /^https?:\/\//i.test(value.trim());
}

function isSpecialUrl(value: string) {
	return /^(data|blob|mailto|tel):/i.test(value.trim());
}

function isProtocolRelativeUrl(value: string) {
	return /^\/\//.test(value.trim());
}

function isRelativeAssetUrl(value: string) {
	return /^(\.\/|\.\.\/|#)/.test(value.trim());
}

function isAlreadyProxied(url: string) {
	return /^https:\/\/wsrv\.nl\/\?url=/i.test(url.trim());
}

function normalizeBasePath(value: string) {
	if (!value) {
		return '';
	}

	return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function isAppLocalImagePath(value: string) {
	const trimmed = value.trim();

	if (
		!hasValue(trimmed) ||
		isRemoteHttpUrl(trimmed) ||
		isSpecialUrl(trimmed) ||
		isProtocolRelativeUrl(trimmed) ||
		isRelativeAssetUrl(trimmed)
	) {
		return false;
	}

	return trimmed.startsWith('/');
}

export function resolveAppImageUrl(url: string) {
	const trimmed = url.trim();

	if (
		!hasValue(trimmed) ||
		!isAppLocalImagePath(trimmed)
	) {
		return trimmed;
	}

	const normalizedBase = normalizeBasePath(base);

	if (!normalizedBase || trimmed === normalizedBase || trimmed.startsWith(`${normalizedBase}/`)) {
		return trimmed;
	}

	return `${normalizedBase}${trimmed}`;
}

function isSameOriginOrLocalUrl(value: string) {
	const trimmed = resolveAppImageUrl(value);

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
	const resolvedUrl = resolveAppImageUrl(url);

	if (!theme?.requiresImageProxy) {
		return false;
	}

	if (
		!hasValue(resolvedUrl) ||
		!isRemoteHttpUrl(resolvedUrl) ||
		isAlreadyProxied(resolvedUrl) ||
		isSameOriginOrLocalUrl(resolvedUrl)
	) {
		return false;
	}

	return true;
}

export function resolveRenderableImageUrl(url: string, themeId: string) {
	const resolvedUrl = resolveAppImageUrl(url);

	if (!shouldProxyThemeImage(resolvedUrl, themeId)) {
		return resolvedUrl;
	}

	return buildProxyUrl(resolvedUrl);
}
