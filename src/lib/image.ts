const AI_COLLECTIVE_THEME_ID = 'ai-collective-panel-default';
const DATA_PHOENIX_THEME_ID = 'data-phoenix-neon-panel';
const WSERV_BASE_URL = 'https://wsrv.nl/';

const PROXIED_THEME_IDS = new Set([AI_COLLECTIVE_THEME_ID, DATA_PHOENIX_THEME_ID]);

function hasValue(value: string) {
	return value.trim().length > 0;
}

function isRemoteHttpUrl(value: string) {
	return /^https?:\/\//i.test(value.trim());
}

function isAlreadyProxied(url: string) {
	return /^https:\/\/wsrv\.nl\/\?url=/i.test(url.trim());
}

function buildProxyUrl(url: string) {
	return `${WSERV_BASE_URL}?url=${encodeURIComponent(url.trim())}`;
}

export function shouldProxyThemeImage(url: string, themeId: string) {
	if (!PROXIED_THEME_IDS.has(themeId)) {
		return false;
	}

	if (!hasValue(url) || !isRemoteHttpUrl(url) || isAlreadyProxied(url)) {
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

export { AI_COLLECTIVE_THEME_ID, DATA_PHOENIX_THEME_ID };
