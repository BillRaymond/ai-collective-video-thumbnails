import type { EventPersonSource, EventSource, ThumbnailEvent, ThumbnailPerson, ThumbnailProject } from './types';

export const DEFAULT_TEMPLATE_ID = 'ai-collective-panel-default';
export const DEFAULT_EVENT_LOGO_URL = '/HumanX-white-logo-cropped.png';
export const DEFAULT_BACKGROUND_URL = '/default-thumbnail-bg.png';
export const DEFAULT_PRODUCER_CREDIT = 'KROK PRODUCTIONS by Data Phoenix';
export const DEFAULT_CTA_TEXT = 'Watch Now';
export const DEFAULT_VARIANT_LABEL = 'Panel Discussion';
export const DEFAULT_EYEBROW_SUFFIX = 'The AI Collective';

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

function asString(value: unknown, fallback = '') {
	return typeof value === 'string' ? value : fallback;
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

function buildDefaultEyebrow(event: EventSource) {
	if (event.day !== undefined && event.day !== null && event.day !== '') {
		return `Day ${event.day} · ${DEFAULT_EYEBROW_SUFFIX}`;
	}

	return DEFAULT_EYEBROW_SUFFIX;
}

function createPersonId(eventId: EventSource['id'], role: string, index: number) {
	return `${eventId}-${role.toLowerCase()}-${index + 1}`;
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

function normalizeThumbnail(event: EventSource, thumbnailValue: unknown) {
	const safeThumbnail = isObject(thumbnailValue) ? thumbnailValue : {};

	return {
		templateId: asString(safeThumbnail.templateId, DEFAULT_TEMPLATE_ID),
		variantLabel: asString(safeThumbnail.variantLabel, DEFAULT_VARIANT_LABEL),
		eyebrow: asString(safeThumbnail.eyebrow, buildDefaultEyebrow(event)),
		eventLogoUrl: asString(safeThumbnail.eventLogoUrl, DEFAULT_EVENT_LOGO_URL),
		backgroundImageUrl: asString(safeThumbnail.backgroundImageUrl, DEFAULT_BACKGROUND_URL),
		producerCredit: asString(safeThumbnail.producerCredit, DEFAULT_PRODUCER_CREDIT),
		ctaText: asString(safeThumbnail.ctaText, DEFAULT_CTA_TEXT),
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
