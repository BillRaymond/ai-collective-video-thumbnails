import Ajv, { type ErrorObject } from 'ajv';
import { DEFAULT_THEME_ID, getThemeById, getThemeLegacyAssetUrlMap } from '$lib/themes';
import type { EventPersonSource, EventSource, ThumbnailConfig, ThumbnailEvent, ThumbnailPerson, ThumbnailProject } from './types';
import sourceEventsSchema from './schemas/source-events.schema.json';
import thumbnailProjectSchema from './schemas/thumbnail-project.schema.json';

const LEGACY_ASSET_URLS = getThemeLegacyAssetUrlMap();
const ajv = new Ajv({ allErrors: true, strict: false });
const validateSourceEventsSchema = ajv.compile(sourceEventsSchema);
const validateThumbnailProjectSchema = ajv.compile(thumbnailProjectSchema);

export class ProjectImportError extends Error {
	headline: string;
	details: string[];

	constructor(headline: string, details: string[] = []) {
		super([headline, ...details].join('\n'));
		this.name = 'ProjectImportError';
		this.headline = headline;
		this.details = details;
	}
}

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

function buildBaseThumbnailDefaults(): Omit<ThumbnailConfig, 'people'> {
	return {
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
		eventLogoUrl: resolveLegacyAssetUrl(
			withFallback(themeDefaults.eventLogoUrl, baseDefaults.eventLogoUrl)
		),
		backgroundImageUrl: resolveLegacyAssetUrl(
			withFallback(themeDefaults.backgroundImageUrl, baseDefaults.backgroundImageUrl)
		),
		producerCredit: withFallback(themeDefaults.producerCredit, baseDefaults.producerCredit),
		ctaText: withFallback(themeDefaults.ctaText, baseDefaults.ctaText),
		people: themeDefaults.people as ThumbnailPerson[] | undefined
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

function createPersonLookupKey(person: Pick<ThumbnailPerson, 'id' | 'role' | 'name' | 'company'>) {
	return `${person.id}::${person.role.trim().toLowerCase()}::${person.name.trim().toLowerCase()}::${person.company.trim().toLowerCase()}`;
}

function backfillDerivedPersonFields(event: EventSource, people: ThumbnailPerson[]) {
	const sourcePeople = buildPeopleFromSource(event);
	const sourceByKey = new Map(
		sourcePeople.map((person) => [createPersonLookupKey(person), person] as const)
	);

	return people.map((person, index) => {
		const sourceMatch =
			sourceByKey.get(createPersonLookupKey(person)) ??
			sourcePeople.find(
				(candidate) =>
					candidate.id === person.id ||
					(
						candidate.role.trim().toLowerCase() === person.role.trim().toLowerCase() &&
						candidate.name.trim().toLowerCase() === person.name.trim().toLowerCase()
					)
			) ??
			sourcePeople[index];

		if (!sourceMatch) {
			return person;
		}

		return {
			...person,
			photoUrl: withFallback(person.photoUrl, sourceMatch.photoUrl),
			companyLogoUrl: withFallback(person.companyLogoUrl, sourceMatch.companyLogoUrl)
		};
	});
}

function normalizeThumbnail(event: EventSource, thumbnailValue: unknown): ThumbnailConfig {
	const safeThumbnail = isObject(thumbnailValue) ? thumbnailValue : {};
	const themeDefaults = buildThemeBackedThumbnailDefaults(event, DEFAULT_THEME_ID);
	const normalizedPeople = Array.isArray(safeThumbnail.people)
		? backfillDerivedPersonFields(
				event,
				safeThumbnail.people.map((person, index) => normalizePerson(event.id, person, index))
			)
		: (themeDefaults.people ?? buildPeopleFromSource(event));

	return {
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
		people: normalizedPeople
	};
}

function formatErrorPath(instancePath: string, missingProperty?: string) {
	const basePath = instancePath ? instancePath.replace(/\//g, '.') : 'root';
	return missingProperty ? `${basePath}.${missingProperty}` : basePath;
}

function describeSchemaError(error: ErrorObject) {
	if (error.keyword === 'additionalProperties') {
		const propertyName =
			typeof error.params.additionalProperty === 'string' ? error.params.additionalProperty : 'unknown';
		return `${formatErrorPath(error.instancePath, propertyName)} is not allowed`;
	}

	if (error.keyword === 'required') {
		const propertyName =
			typeof error.params.missingProperty === 'string' ? error.params.missingProperty : 'unknown';
		return `${formatErrorPath(error.instancePath, propertyName)} is required`;
	}

	return `${formatErrorPath(error.instancePath)} ${error.message ?? 'is invalid'}`;
}

function humanizeSchemaPath(path: string) {
	const trimmed = path.replace(/^root\.?/, '');
	if (!trimmed) {
		return 'Top level';
	}

	const segments = trimmed.split('.').filter(Boolean);
	const parts: string[] = [];

	for (const segment of segments) {
		if (/^\d+$/.test(segment)) {
			parts.push(`Event ${Number(segment) + 1}`);
			continue;
		}

		parts.push(segment);
	}

	return parts.join(' -> ');
}

function formatSchemaErrorDetails(errors: ErrorObject[] | null | undefined) {
	if (!errors?.length) {
		return ['Unknown schema validation error.'];
	}

	return errors.slice(0, 5).map((error) => {
		const description = describeSchemaError(error);
		const [path, ...rest] = description.split(' ');
		return `${humanizeSchemaPath(path)}: ${rest.join(' ')}`;
	});
}

function ensureValidSourceEvents(value: unknown) {
	if (validateSourceEventsSchema(value)) {
		return;
	}

	throw new ProjectImportError(
		'Upload blocked: the file is not valid raw event JSON.',
		[
			'Only source-event fields are allowed in raw uploads.',
			...formatSchemaErrorDetails(validateSourceEventsSchema.errors)
		]
	);
}

function ensureValidThumbnailProject(value: unknown) {
	if (validateThumbnailProjectSchema(value)) {
		return;
	}

	throw new ProjectImportError(
		'Upload blocked: the file is not a valid thumbnail project export.',
		formatSchemaErrorDetails(validateThumbnailProjectSchema.errors)
	);
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

export function parseProjectImport(value: unknown): ThumbnailProject {
	if (Array.isArray(value)) {
		ensureValidSourceEvents(value);
		return normalizeProject(value);
	}

	if (isObject(value) && Array.isArray(value.events)) {
		ensureValidThumbnailProject(value);
		return normalizeProject(value);
	}

	throw new ProjectImportError(
		'Upload blocked: unsupported JSON format.',
		['Expected either a raw event array or an exported thumbnail project object.']
	);
}

export function cloneProject(project: ThumbnailProject): ThumbnailProject {
	return JSON.parse(JSON.stringify(project)) as ThumbnailProject;
}

export function applyThemeToThumbnail(event: EventSource, thumbnail: ThumbnailConfig, nextThemeId: string) {
	const themeDefaults = buildThemeBackedThumbnailDefaults(event, nextThemeId);

	return {
		...thumbnail,
		eventLogoUrl: resolveLegacyAssetUrl(withFallback(thumbnail.eventLogoUrl, themeDefaults.eventLogoUrl)),
		backgroundImageUrl: resolveLegacyAssetUrl(
			withFallback(thumbnail.backgroundImageUrl, themeDefaults.backgroundImageUrl)
		),
		producerCredit: withFallback(thumbnail.producerCredit, themeDefaults.producerCredit),
		ctaText: withFallback(thumbnail.ctaText, themeDefaults.ctaText),
		people: thumbnail.people.map((p, i) => {
			const themePerson = themeDefaults.people?.[i];
			return {
				...p,
				name: themePerson?.name ?? p.name,
				companyLogoUrl: themePerson ? themePerson.companyLogoUrl : p.companyLogoUrl
			};
		})
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
