import { DEFAULT_THEME_ID, getThemeById, getThemeLegacyAssetUrlMap } from '$lib/themes';
import type { EventPersonSource, EventSource, ThumbnailConfig, ThumbnailEvent, ThumbnailPerson, ThumbnailProject } from './types';

const LEGACY_ASSET_URLS = getThemeLegacyAssetUrlMap();

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

function asString(value: unknown, fallback = '') {
	return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown) {
	return typeof value === 'string' ? value : undefined;
}

function withFallback(value: unknown, fallback = '') {
	const normalized = typeof value === 'string' ? value.trim() : '';
	return normalized ? asString(value) : fallback;
}

function resolveLegacyAssetUrl(value: string) {
	return LEGACY_ASSET_URLS[value] ?? value;
}

function asPeople(value: unknown): EventPersonSource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((person) => {
		const safePerson = isObject(person) ? person : {};

		return {
			name: asString(safePerson.name),
			company: asString(safePerson.company),
			photo_url: asString(safePerson.photo_url),
			company_logo_url: asString(safePerson.company_logo_url)
		};
	});
}

function normalizeEventSource(value: unknown): EventSource {
	const safeEvent = isObject(value) ? value : {};

	return {
		id: typeof safeEvent.id === 'number' || typeof safeEvent.id === 'string' ? safeEvent.id : '',
		day:
			typeof safeEvent.day === 'number' || typeof safeEvent.day === 'string' ? safeEvent.day : undefined,
		title: asString(safeEvent.title, 'Untitled Event'),
		moderators: asPeople(safeEvent.moderators),
		confirmed_speakers: asPeople(safeEvent.confirmed_speakers)
	};
}

function createPersonId(eventId: EventSource['id'], role: string, index: number) {
	return `${eventId}-${role.toLowerCase()}-${index + 1}`;
}

function buildBaseThumbnailDefaults(): Omit<ThumbnailConfig, 'templateId' | 'people'> {
	return {
		variantLabel: '',
		eyebrow: '',
		eventLogoUrl: '',
		backgroundImageUrl: '',
		producerCredit: '',
		ctaText: ''
	};
}

function buildThemeBackedThumbnailDefaults(event: EventSource, themeId: string) {
	const theme = getThemeById(themeId);
	const baseDefaults = buildBaseThumbnailDefaults();
	const themeDefaults = theme?.defaults(event) ?? {};

	return {
		themeId: theme?.meta.id ?? DEFAULT_THEME_ID,
		variantLabel: withFallback(themeDefaults.variantLabel, baseDefaults.variantLabel),
		eyebrow: withFallback(themeDefaults.eyebrow, baseDefaults.eyebrow),
		eventLogoUrl: resolveLegacyAssetUrl(
			withFallback(themeDefaults.eventLogoUrl, baseDefaults.eventLogoUrl)
		),
		backgroundImageUrl: resolveLegacyAssetUrl(
			withFallback(themeDefaults.backgroundImageUrl, baseDefaults.backgroundImageUrl)
		),
		producerCredit: withFallback(themeDefaults.producerCredit, baseDefaults.producerCredit),
		ctaText: withFallback(themeDefaults.ctaText, baseDefaults.ctaText)
	};
}

export function buildPeopleFromSource(event: EventSource): ThumbnailPerson[] {
	const moderators = event.moderators.map((person, index) => ({
		id: createPersonId(event.id, 'moderator', index),
		role: 'Moderator',
		name: person.name,
		company: person.company,
		photoUrl: person.photo_url,
		companyLogoUrl: person.company_logo_url,
		photoPositionX: 50,
		photoPositionY: 50,
		logoScale: 100
	}));

	const speakers = event.confirmed_speakers.map((person, index) => ({
		id: createPersonId(event.id, 'panelist', index),
		role: 'Panelist',
		name: person.name,
		company: person.company,
		photoUrl: person.photo_url,
		companyLogoUrl: person.company_logo_url,
		photoPositionX: 50,
		photoPositionY: 50,
		logoScale: 100
	}));

	return [...moderators, ...speakers];
}

function normalizePerson(eventId: EventSource['id'], value: unknown, index: number): ThumbnailPerson {
	const safePerson = isObject(value) ? value : {};

	return {
		id: asString(safePerson.id, createPersonId(eventId, 'person', index)),
		role: asString(safePerson.role, 'Panelist'),
		name: asString(safePerson.name),
		company: asString(safePerson.company),
		photoUrl: asString(safePerson.photoUrl),
		companyLogoUrl: asString(safePerson.companyLogoUrl),
		photoPositionX:
			typeof safePerson.photoPositionX === 'number' ? safePerson.photoPositionX : 50,
		photoPositionY:
			typeof safePerson.photoPositionY === 'number' ? safePerson.photoPositionY : 50,
		logoScale: typeof safePerson.logoScale === 'number' ? safePerson.logoScale : 100
	};
}

function normalizeThumbnail(event: EventSource, thumbnailValue: unknown): ThumbnailConfig {
	const safeThumbnail = isObject(thumbnailValue) ? thumbnailValue : {};
	const requestedThemeId = asString(safeThumbnail.templateId, DEFAULT_THEME_ID);
	const themeDefaults = buildThemeBackedThumbnailDefaults(event, requestedThemeId);

	return {
		templateId: themeDefaults.themeId,
		variantLabel: withFallback(asOptionalString(safeThumbnail.variantLabel), themeDefaults.variantLabel),
		eyebrow: withFallback(asOptionalString(safeThumbnail.eyebrow), themeDefaults.eyebrow),
		eventLogoUrl: resolveLegacyAssetUrl(
			withFallback(asOptionalString(safeThumbnail.eventLogoUrl), themeDefaults.eventLogoUrl)
		),
		backgroundImageUrl: resolveLegacyAssetUrl(
			withFallback(asOptionalString(safeThumbnail.backgroundImageUrl), themeDefaults.backgroundImageUrl)
		),
		producerCredit: withFallback(
			asOptionalString(safeThumbnail.producerCredit),
			themeDefaults.producerCredit
		),
		ctaText: withFallback(asOptionalString(safeThumbnail.ctaText), themeDefaults.ctaText),
		people: Array.isArray(safeThumbnail.people)
			? safeThumbnail.people.map((person, index) => normalizePerson(event.id, person, index))
			: buildPeopleFromSource(event)
	};
}

export function normalizeThumbnailEvent(value: unknown): ThumbnailEvent {
	const event = normalizeEventSource(value);
	const safeEvent = isObject(value) ? value : {};

	return {
		...event,
		thumbnail: normalizeThumbnail(event, safeEvent.thumbnail)
	};
}

export function normalizeProject(value: unknown): ThumbnailProject {
	const now = new Date().toISOString();

	if (Array.isArray(value)) {
		return {
			version: '1.0',
			generatedBy: 'ai-collective-thumbnail-studio',
			exportedAt: now,
			events: value.map((event) => normalizeThumbnailEvent(event))
		};
	}

	if (isObject(value) && Array.isArray(value.events)) {
		return {
			version: '1.0',
			generatedBy: 'ai-collective-thumbnail-studio',
			exportedAt: now,
			events: value.events.map((event) => normalizeThumbnailEvent(event))
		};
	}

	return {
		version: '1.0',
		generatedBy: 'ai-collective-thumbnail-studio',
		exportedAt: now,
		events: []
	};
}

export function cloneProject(project: ThumbnailProject): ThumbnailProject {
	return JSON.parse(JSON.stringify(project)) as ThumbnailProject;
}

export function applyThemeToThumbnail(event: EventSource, thumbnail: ThumbnailConfig, nextThemeId: string) {
	const themeDefaults = buildThemeBackedThumbnailDefaults(event, nextThemeId);

	return {
		...thumbnail,
		templateId: themeDefaults.themeId,
		variantLabel: withFallback(thumbnail.variantLabel, themeDefaults.variantLabel),
		eyebrow: withFallback(thumbnail.eyebrow, themeDefaults.eyebrow),
		eventLogoUrl: resolveLegacyAssetUrl(withFallback(thumbnail.eventLogoUrl, themeDefaults.eventLogoUrl)),
		backgroundImageUrl: resolveLegacyAssetUrl(
			withFallback(thumbnail.backgroundImageUrl, themeDefaults.backgroundImageUrl)
		),
		producerCredit: withFallback(thumbnail.producerCredit, themeDefaults.producerCredit),
		ctaText: withFallback(thumbnail.ctaText, themeDefaults.ctaText)
	} satisfies ThumbnailConfig;
}

export function applyThemeToProject(project: ThumbnailProject, nextThemeId: string): ThumbnailProject {
	return {
		...project,
		events: project.events.map((event) => ({
			...event,
			thumbnail: applyThemeToThumbnail(event, event.thumbnail, nextThemeId)
		}))
	};
}

export function createEmptyPerson(eventId: EventSource['id'], peopleCount: number): ThumbnailPerson {
	return {
		id: createPersonId(eventId, 'custom', peopleCount),
		role: 'Panelist',
		name: '',
		company: '',
		photoUrl: '',
		companyLogoUrl: '',
		photoPositionX: 50,
		photoPositionY: 50,
		logoScale: 100
	};
}

export function projectToJson(project: ThumbnailProject) {
	return JSON.stringify(
		{
			version: project.version,
			generatedBy: project.generatedBy,
			exportedAt: new Date().toISOString(),
			events: project.events
		},
		null,
		2
	);
}
