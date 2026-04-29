<svelte:head>
	<title>AI Collective Thumbnail Studio</title>
	<meta
		name="description"
		content="Upload event JSON, edit speaker and brand details, preview the layout, and export AI Collective video thumbnails."
	/>
</svelte:head>

<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { tick } from 'svelte';
	import sampleEvents from '../../default-list.json';
	import sourceEventsSchema from '$lib/schemas/source-events.schema.json';
	import { CANVAS_HEIGHT, CANVAS_WIDTH } from '$lib/constants';
	import { isAppLocalImagePath, resolveAppImageUrl, resolveRenderableImageUrl } from '$lib/image';
	import {
		applyThemeToProject,
		buildThemeBackedThumbnailDefaults,
		cloneProject,
		createEmptyPerson,
		ProjectImportError,
		parseProjectImport,
		projectToJson
	} from '$lib/project';
	import { getThemeById, thumbnailThemes } from '$lib/themes';
	import {
		buildThumbnailFilename,
		downloadSingleThumbnail,
		downloadZipFromBlobs,
		renderThumbnailBlob,
		renderThumbnailPreviewUrl,
		triggerDownload
	} from '$lib/export';
	import type { PreviewRenderResult } from '$lib/export';
	import type {
		ExportFormat,
		ImageStatus,
		ThumbnailEvent,
		ThumbnailPerson,
		ThumbnailProject,
		ThumbnailThemePersonField,
		ThumbnailThemeTextField
	} from '$lib/types';

	type EditorSection = 'content' | 'style' | 'people' | 'orgs';
	type EditorSubsection =
		| 'title'
		| 'imagery'
		| 'overlays'
		| 'roster'
		| 'details';
	type AppMenu = 'none' | 'actions' | 'export' | 'events';
	type DropPlacement = 'before' | 'after';
	type OrgField = 'company' | 'companyLogoUrl' | 'companyLogoHasBackground';
	type OrgRow = {
		key: string;
		company: string;
		companyLogoUrl: string;
		companyLogoHasBackground: boolean;
		peopleCount: number;
	};

	const sampleProject = parseProjectImport(sampleEvents);
	const initialSelectedEventId = `${sampleProject.events[0]?.id ?? ''}`;
	const initialOpenPersonId = sampleProject.events[0]?.thumbnail.people[0]?.id ?? '';
	const initialThemeId = thumbnailThemes[0]?.meta.id ?? '';
	const editorSections: Array<{ id: EditorSection; label: string }> = [
		{ id: 'content', label: 'Content' },
		{ id: 'style', label: 'Style' },
		{ id: 'people', label: 'People' },
		{ id: 'orgs', label: 'Orgs' }
	];

	const statusLabel: Record<ImageStatus, string> = {
		idle: 'Not checked',
		loading: 'Checking',
		valid: 'Ready',
		failed: 'Failed'
	};

	let project = $state<ThumbnailProject>(cloneProject(sampleProject));
	let selectedEventId = $state<string>(initialSelectedEventId);
	let selectedThemeId = $state<string>(initialThemeId);
	let projectName = $state('ai-collective-events');
	let openEditorSection = $state<EditorSection>('content');
	let openEditorSubsection = $state<EditorSubsection>('title');
	let openPersonId = $state<string>(initialOpenPersonId);
	let isEventSummaryExpanded = $state(false);
	let openAppMenu = $state<AppMenu>('none');
	let importError = $state('');
	let importErrorDetails = $state<string[]>([]);
	let exportError = $state('');
	let exportMessage = $state('');
	let isExporting = $state(false);
	let exportRenderNode = $state<HTMLElement | null>(null);
	let exportSavedNotice = $state('');
	let exportSavedTimeout: ReturnType<typeof setTimeout> | null = null;
	let previewViewport = $state<HTMLElement | null>(null);
	let previewScale = $state(1);
	let urlStatuses = $state<Record<string, ImageStatus>>({});
	let isPreviewModalOpen = $state(false);
	let isPreviewModalLoading = $state(false);
	let previewModalError = $state('');
	let previewImageUrl = $state('');
	let previewImageKind = $state<PreviewRenderResult['kind']>('raster');
	let previewImageLoaded = $state(false);
	let previewModalEventId = $state('');
	let draggedPersonId = $state('');
	let dragOverPersonId = $state('');
	let dragOverPlacement = $state<DropPlacement>('before');
	let peopleOrderSnapshots = $state<Record<string, string[]>>({});

	function getActiveEvent() {
		return project.events.find((event) => `${event.id}` === selectedEventId) ?? project.events[0] ?? null;
	}

	function getActiveEventIndex() {
		return project.events.findIndex((event) => `${event.id}` === selectedEventId);
	}

	let activeEvent = $derived(getActiveEvent());
	let activeEventIndex = $derived(getActiveEventIndex());
	let activeTheme = $derived(selectedThemeId ? getThemeById(selectedThemeId) : null);
	let visibleEditorSections = $derived(
		editorSections.filter((section) => {
			if (!activeTheme) {
				return true;
			}

			if (section.id === 'content') {
				return true;
			}

			if (section.id === 'style') {
				return activeTheme.editor.brandingFields.length > 0;
			}

			if (section.id === 'people') {
				return activeTheme.editor.personFields.length > 0;
			}

			return (
				activeTheme.editor.personFields.includes('company') ||
				activeTheme.editor.personFields.includes('companyLogoUrl') ||
				activeTheme.editor.personFields.includes('companyLogoHasBackground')
			);
		})
	);
	let activePerson = $derived(
		activeEvent?.thumbnail.people.find((person) => person.id === openPersonId) ??
			activeEvent?.thumbnail.people[0] ??
			null
	);
	let activeOrgs = $derived(buildOrgRows(activeEvent));
	let activePeopleOrderChanged = $derived(
		activeEvent ? Boolean(peopleOrderSnapshots[`${activeEvent.id}`]) : false
	);
	let visibleEditorSubsections = $derived(getEditorSubsections(openEditorSection));

	function themeSupportsTextField(field: ThumbnailThemeTextField) {
		return activeTheme?.editor.brandingFields.includes(field) ?? false;
	}

	function themeSupportsPersonField(field: ThumbnailThemePersonField) {
		return activeTheme?.editor.personFields.includes(field) ?? false;
	}

	function getEditorSubsections(
		section: EditorSection
	): Array<{ id: EditorSubsection; label: string }> {
		if (!activeTheme) {
			if (section === 'content') {
				return [{ id: 'title', label: 'Title' }];
			}

			if (section === 'style') {
				return [];
			}

			return [
				{ id: 'roster', label: 'Roster' },
				{ id: 'details', label: 'Details' }
			];
		}

		if (section === 'content') {
			return [{ id: 'title', label: 'Title' }];
		}

		if (section === 'style') {
			const subsections: Array<{ id: EditorSubsection; label: string }> = [];

			if (
				themeSupportsTextField('backgroundImageUrl') ||
				themeSupportsTextField('eventLogoUrl')
			) {
				subsections.push({ id: 'imagery', label: 'Imagery' });
			}

			if (
				themeSupportsTextField('producerCredit') ||
				themeSupportsTextField('ctaText')
			) {
				subsections.push({ id: 'overlays', label: 'Overlays' });
			}

			return subsections;
		}

		if (section === 'orgs') {
			return [];
		}

		return [
			{ id: 'roster', label: 'Roster' },
			{ id: 'details', label: 'Details' }
		];
	}

	function buildOrgRows(event: ThumbnailEvent | null): OrgRow[] {
		if (!event) {
			return [];
		}

		const orgs = new Map<string, OrgRow>();

		for (const person of event.thumbnail.people) {
			const key = normalizeMatchKey(person.company);

			if (!key) {
				continue;
			}

			const existing = orgs.get(key);

			if (existing) {
				existing.peopleCount += 1;
				continue;
			}

			orgs.set(key, {
				key,
				company: person.company,
				companyLogoUrl: person.companyLogoUrl,
				companyLogoHasBackground: person.companyLogoHasBackground,
				peopleCount: 1
			});
		}

		return [...orgs.values()].sort((left, right) => left.company.localeCompare(right.company));
	}

	function toggleAppMenu(menu: Exclude<AppMenu, 'none'>) {
		openAppMenu = openAppMenu === menu ? 'none' : menu;
	}

	function closeMenus() {
		openAppMenu = 'none';
	}

	function runMenuAction(action: () => void | Promise<void>) {
		closeMenus();
		void action();
	}

	function setPreviewImageUrl(nextUrl: string) {
		if (previewImageUrl.startsWith('blob:') && previewImageUrl !== nextUrl) {
			URL.revokeObjectURL(previewImageUrl);
		}

		previewImageUrl = nextUrl;
	}

	function setPreviewRenderResult(result: PreviewRenderResult) {
		previewImageKind = result.kind;
		previewImageLoaded = result.kind === 'svg';
		setPreviewImageUrl(result.url);
	}

	function normalizeMatchKey(value: string) {
		return value.trim().toLowerCase();
	}

	function syncActiveSelections() {
		if (!activeEvent) {
			selectedEventId = '';
			selectedThemeId = '';
			openPersonId = '';
			openAppMenu = 'none';
			return;
		}

		selectedEventId = `${activeEvent.id}`;

		if (!activeEvent.thumbnail.people.some((person) => person.id === openPersonId)) {
			openPersonId = activeEvent.thumbnail.people[0]?.id ?? '';
		}

		if (!visibleEditorSections.some((section) => section.id === openEditorSection)) {
			openEditorSection = visibleEditorSections[0]?.id ?? 'content';
		}

		const allowedSubsections = getEditorSubsections(openEditorSection);
		if (!allowedSubsections.some((section) => section.id === openEditorSubsection)) {
			openEditorSubsection = allowedSubsections[0]?.id ?? 'title';
		}
	}

	$effect(() => {
		syncActiveSelections();
	});

	$effect(() => {
		return () => {
			if (previewImageUrl.startsWith('blob:')) {
				URL.revokeObjectURL(previewImageUrl);
			}

			if (exportSavedTimeout) {
				clearTimeout(exportSavedTimeout);
			}
		};
	});

	$effect(() => {
		if (!browser || openAppMenu === 'none') {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;

			if (target instanceof Element && target.closest('.menu-shell')) {
				return;
			}

			closeMenus();
		};

		document.addEventListener('pointerdown', handlePointerDown);
		return () => document.removeEventListener('pointerdown', handlePointerDown);
	});

	function showExportSavedNotice(message: string) {
		exportSavedNotice = message;

		if (exportSavedTimeout) {
			clearTimeout(exportSavedTimeout);
		}

		exportSavedTimeout = setTimeout(() => {
			exportSavedNotice = '';
			exportSavedTimeout = null;
		}, 1800);
	}

	$effect(() => {
		if (!browser || !isPreviewModalOpen) {
			return;
		}

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closePreviewModal();
				return;
			}

			if (event.key === 'ArrowLeft') {
				navigatePreviewModal(-1);
				return;
			}

			if (event.key === 'ArrowRight') {
				navigatePreviewModal(1);
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	function updatePreviewScale() {
		if (!previewViewport) {
			previewScale = 1;
			return;
		}

		const { width } = previewViewport.getBoundingClientRect();
		previewScale = Math.min(Math.max((width - 24) / CANVAS_WIDTH, 0.2), 1);
	}

	$effect(() => {
		if (!browser || !previewViewport) {
			return;
		}

		updatePreviewScale();
		const observer = new ResizeObserver(() => updatePreviewScale());
		observer.observe(previewViewport);
		return () => observer.disconnect();
	});

	function setProject(nextProject: ThumbnailProject) {
		project = nextProject;
		project.exportedAt = new Date().toISOString();
		importError = '';
		exportError = '';
	}

	function updateEvent(eventId: string, updater: (event: ThumbnailEvent) => ThumbnailEvent) {
		setProject({
			...project,
			events: project.events.map((event) => (`${event.id}` === eventId ? updater(event) : event))
		});
	}

	function updateProjectTheme(themeId: string) {
		closeMenus();
		selectedThemeId = themeId;
		setProject(applyThemeToProject(project, themeId));
	}

	function updateAllPeople(
		shouldUpdate: (person: ThumbnailPerson) => boolean,
		updater: (person: ThumbnailPerson) => ThumbnailPerson
	) {
		setProject({
			...project,
			events: project.events.map((event) => ({
				...event,
				thumbnail: {
					...event.thumbnail,
					people: event.thumbnail.people.map((person) =>
						shouldUpdate(person) ? updater(person) : person
					)
				}
			}))
		});
	}

	function findPerson(personId: string) {
		for (const event of project.events) {
			const person = event.thumbnail.people.find((entry) => entry.id === personId);
			if (person) {
				return { event, person };
			}
		}

		return null;
	}

	function updatePersonLocal(personId: string, updater: (person: ThumbnailPerson) => ThumbnailPerson) {
		if (!activeEvent) {
			return;
		}

		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people: event.thumbnail.people.map((person) =>
					person.id === personId ? updater(person) : person
				)
			}
		}));
	}

	function updatePersonField(
		personId: string,
		field: keyof ThumbnailPerson,
		value: string | number | boolean
	) {
		const source = findPerson(personId);
		if (!source) {
			return;
		}

		if (field === 'name') {
			const previousNameKey = normalizeMatchKey(source.person.name);

			if (!previousNameKey) {
				updatePersonLocal(personId, (person) => ({ ...person, name: String(value) }));
				return;
			}

			updateAllPeople(
				(person) => normalizeMatchKey(person.name) === previousNameKey,
				(person) => ({ ...person, name: String(value) })
			);
			return;
		}

		if (field === 'photoUrl') {
			const nameKey = normalizeMatchKey(source.person.name);

			if (!nameKey) {
				updatePersonLocal(personId, (person) => ({ ...person, photoUrl: String(value) }));
				return;
			}

			updateAllPeople(
				(person) => normalizeMatchKey(person.name) === nameKey,
				(person) => ({ ...person, photoUrl: String(value) })
			);
			return;
		}

		if (field === 'company') {
			const previousCompanyKey = normalizeMatchKey(source.person.company);

			if (!previousCompanyKey) {
				updatePersonLocal(personId, (person) => ({ ...person, company: String(value) }));
				return;
			}

			updateAllPeople(
				(person) => normalizeMatchKey(person.company) === previousCompanyKey,
				(person) => ({ ...person, company: String(value) })
			);
			return;
		}

		if (field === 'companyLogoUrl') {
			const companyKey = normalizeMatchKey(source.person.company);

			if (!companyKey) {
				updatePersonLocal(personId, (person) => ({ ...person, companyLogoUrl: String(value) }));
				return;
			}

			updateAllPeople(
				(person) => normalizeMatchKey(person.company) === companyKey,
				(person) => ({ ...person, companyLogoUrl: String(value) })
			);
			return;
		}

		if (field === 'companyLogoHasBackground') {
			const companyKey = normalizeMatchKey(source.person.company);

			if (!companyKey) {
				updatePersonLocal(personId, (person) => ({
					...person,
					companyLogoHasBackground: Boolean(value)
				}));
				return;
			}

			updateAllPeople(
				(person) => normalizeMatchKey(person.company) === companyKey,
				(person) => ({ ...person, companyLogoHasBackground: Boolean(value) })
			);
			return;
		}

		updatePersonLocal(personId, (person) => ({ ...person, [field]: value }));
	}

	function updateOrgField(orgKey: string, field: OrgField, value: string | boolean) {
		if (!activeEvent) {
			return;
		}

		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people: event.thumbnail.people.map((person) => {
					if (normalizeMatchKey(person.company) !== orgKey) {
						return person;
					}

					if (field === 'company') {
						return { ...person, company: String(value) };
					}

					if (field === 'companyLogoUrl') {
						return { ...person, companyLogoUrl: String(value) };
					}

					return { ...person, companyLogoHasBackground: Boolean(value) };
				})
			}
		}));
	}

	function updateActiveEventField(
		field: 'title' | 'type' | 'location' | 'location_logo_url' | 'day',
		value: string
	) {
		if (!activeEvent) {
			return;
		}

		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			[field]:
				field === 'location_logo_url'
					? resolveAppImageUrl(value)
					: field === 'day'
						? value.trim() === ''
							? undefined
							: value.trim()
						: value
		}));
	}

	function updateActiveThumbnailField(
		field: keyof ThumbnailEvent['thumbnail'],
		value: string | boolean
	) {
		if (!activeEvent) {
			return;
		}

		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				[field]: value
			}
		}));
	}

	function selectEvent(eventId: string) {
		selectedEventId = eventId;
		const nextEvent = project.events.find((event) => `${event.id}` === eventId);
		openPersonId = nextEvent?.thumbnail.people[0]?.id ?? '';
		closeMenus();
	}

	function setEditorSection(section: EditorSection) {
		closeMenus();
		openEditorSection = section;
		openEditorSubsection = getEditorSubsections(section)[0]?.id ?? 'title';
	}

	function setEditorSubsection(subsection: EditorSubsection) {
		closeMenus();
		openEditorSubsection = subsection;
	}

	function navigateEvent(direction: -1 | 1) {
		closeMenus();
		if (activeEventIndex < 0) {
			return;
		}

		const nextIndex = activeEventIndex + direction;
		if (nextIndex < 0 || nextIndex >= project.events.length) {
			return;
		}

		selectEvent(`${project.events[nextIndex]?.id ?? ''}`);
	}

	function createNextEventId() {
		const numericIds = project.events
			.map((event) => Number(event.id))
			.filter((id) => Number.isFinite(id));

		if (numericIds.length > 0) {
			return Math.max(...numericIds) + 1;
		}

		return `event-${project.events.length + 1}`;
	}

	function createBlankEvent(): ThumbnailEvent {
		const id = createNextEventId();
		const sourceEvent = {
			id,
			title: 'Untitled Event',
			type: '',
			location: '',
			location_logo_url: '',
			moderators: [],
			confirmed_speakers: []
		};
		const themeDefaults = buildThemeBackedThumbnailDefaults(sourceEvent, selectedThemeId);

		return {
			...sourceEvent,
			thumbnail: {
				eventLogoUrl: themeDefaults.eventLogoUrl,
				backgroundImageUrl: themeDefaults.backgroundImageUrl,
				producerCredit: themeDefaults.producerCredit,
				ctaText: themeDefaults.ctaText,
				locationLogoHasBackground: themeDefaults.locationLogoHasBackground,
				capitalizePersonNames: themeDefaults.capitalizePersonNames,
				capitalizeCompanyNames: themeDefaults.capitalizeCompanyNames,
				people: []
			}
		};
	}

	function addBlankEvent() {
		const newEvent = createBlankEvent();

		setProject({
			...project,
			events: [...project.events, newEvent]
		});
		selectedEventId = `${newEvent.id}`;
		openEditorSection = 'content';
		openEditorSubsection = 'title';
		openPersonId = '';
	}

	function addPerson(nextSubsection: EditorSubsection = 'details') {
		if (!activeEvent) {
			return;
		}

		const newPerson = createEmptyPerson(activeEvent.id, activeEvent.thumbnail.people.length + 1);
		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people: [...event.thumbnail.people, newPerson]
			}
		}));
		openEditorSection = 'people';
		openEditorSubsection = nextSubsection;
		openPersonId = newPerson.id;
	}

	function removePerson(personId: string) {
		if (!activeEvent) {
			return;
		}

		const removedPersonIndex = activeEvent.thumbnail.people.findIndex((person) => person.id === personId);
		const remainingPeople = activeEvent.thumbnail.people.filter((person) => person.id !== personId);
		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people: remainingPeople
			}
		}));
		openPersonId = remainingPeople.some((person) => person.id === openPersonId)
			? openPersonId
			: (remainingPeople[Math.max(0, removedPersonIndex - 1)]?.id ?? remainingPeople[0]?.id ?? '');
	}

	function startPersonDrag(dragEvent: DragEvent, personId: string) {
		draggedPersonId = personId;
		dragOverPersonId = personId;
		dragOverPlacement = 'before';
		openPersonId = personId;
		dragEvent.dataTransfer?.setData('text/plain', personId);
		if (dragEvent.dataTransfer) {
			dragEvent.dataTransfer.effectAllowed = 'move';
		}
	}

	function updatePersonDropTarget(dragEvent: DragEvent, personId: string) {
		if (!draggedPersonId || draggedPersonId === personId) {
			return;
		}

		dragEvent.preventDefault();
		if (dragEvent.dataTransfer) {
			dragEvent.dataTransfer.dropEffect = 'move';
		}

		const row = dragEvent.currentTarget as HTMLElement;
		const { top, height } = row.getBoundingClientRect();
		dragOverPersonId = personId;
		dragOverPlacement = dragEvent.clientY > top + height / 2 ? 'after' : 'before';
	}

	function reorderPerson(personId: string, targetPersonId: string, placement: DropPlacement) {
		if (!activeEvent || personId === targetPersonId) {
			return;
		}

		const eventId = `${activeEvent.id}`;
		const people = [...activeEvent.thumbnail.people];
		const fromIndex = people.findIndex((person) => person.id === personId);
		const targetIndex = people.findIndex((person) => person.id === targetPersonId);

		if (fromIndex < 0 || targetIndex < 0) {
			return;
		}

		const [movedPerson] = people.splice(fromIndex, 1);
		if (!movedPerson) {
			return;
		}

		const adjustedTargetIndex = people.findIndex((person) => person.id === targetPersonId);
		const insertIndex = placement === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
		people.splice(insertIndex, 0, movedPerson);

		if (!peopleOrderSnapshots[eventId]) {
			peopleOrderSnapshots = {
				...peopleOrderSnapshots,
				[eventId]: activeEvent.thumbnail.people.map((person) => person.id)
			};
		}

		updateEvent(eventId, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people
			}
		}));
		openPersonId = personId;
	}

	function resetPersonOrder() {
		if (!activeEvent) {
			return;
		}

		const eventId = `${activeEvent.id}`;
		const snapshot = peopleOrderSnapshots[eventId];
		if (!snapshot) {
			return;
		}

		const peopleById = new Map(activeEvent.thumbnail.people.map((person) => [person.id, person] as const));
		const restoredPeople = snapshot
			.map((personId) => peopleById.get(personId))
			.filter((person): person is ThumbnailPerson => Boolean(person));
		const restoredIds = new Set(restoredPeople.map((person) => person.id));
		const newPeople = activeEvent.thumbnail.people.filter((person) => !restoredIds.has(person.id));

		updateEvent(eventId, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people: [...restoredPeople, ...newPeople]
			}
		}));

		const { [eventId]: _removed, ...remainingSnapshots } = peopleOrderSnapshots;
		peopleOrderSnapshots = remainingSnapshots;
	}

	function dropPerson(dragEvent: DragEvent, targetPersonId: string) {
		dragEvent.preventDefault();
		const personId = draggedPersonId || dragEvent.dataTransfer?.getData('text/plain') || '';
		reorderPerson(personId, targetPersonId, dragOverPlacement);
		clearPersonDrag();
	}

	function clearPersonDrag() {
		draggedPersonId = '';
		dragOverPersonId = '';
		dragOverPlacement = 'before';
	}

	function markUrl(url: string, status: ImageStatus) {
		if (!url) {
			return;
		}

		urlStatuses = { ...urlStatuses, [url]: status };
	}

	function getRenderableUrl(url: string) {
		const resolvedUrl = resolveAppImageUrl(url);

		if (!activeTheme) {
			return resolvedUrl;
		}

		return resolveRenderableImageUrl(resolvedUrl, activeTheme.meta.id);
	}

	function ensureUrlStatus(url: string) {
		if (!browser || !url || urlStatuses[url] === 'valid' || urlStatuses[url] === 'loading') {
			return;
		}

		if (isAppLocalImagePath(url)) {
			markUrl(url, 'valid');
			return;
		}

		const renderableUrl = getRenderableUrl(url);
		markUrl(url, 'loading');
		const image = new Image();
		image.onload = () => markUrl(url, 'valid');
		image.onerror = () => markUrl(url, 'failed');
		image.crossOrigin = 'anonymous';
		image.src = renderableUrl;
	}

	$effect(() => {
		if (!activeEvent) {
			return;
		}

		const urls = [
			activeEvent.thumbnail.backgroundImageUrl,
			activeEvent.thumbnail.eventLogoUrl,
			activeEvent.location_logo_url,
			...activeEvent.thumbnail.people.flatMap((person) => [person.photoUrl, person.companyLogoUrl])
		].filter((url): url is string => Boolean(url));

		for (const url of urls) {
			ensureUrlStatus(url);
		}
	});

	function getUrlStatus(url: string) {
		if (!url) {
			return 'idle';
		}

		return urlStatuses[url] ?? 'idle';
	}

	async function importJsonFile(event: Event) {
		closeMenus();
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}

		try {
			const text = await file.text();
			const parsed = JSON.parse(text);
			const normalized = parseProjectImport(parsed);
			setProject(normalized);
			projectName = file.name.replace(/\.json$/i, '') || 'ai-collective-events';
			selectedEventId = `${normalized.events[0]?.id ?? ''}`;
			selectedThemeId = thumbnailThemes[0]?.meta.id ?? '';
			openPersonId = normalized.events[0]?.thumbnail.people[0]?.id ?? '';
			openEditorSection = 'content';
			openEditorSubsection = 'title';
		} catch (error) {
			if (error instanceof ProjectImportError) {
				importError = error.headline;
				importErrorDetails = error.details;
			} else {
				importError = error instanceof Error ? error.message : 'The JSON file could not be parsed.';
				importErrorDetails = [];
			}
		} finally {
			input.value = '';
		}
	}

	function loadSampleProject() {
		const nextProject = cloneProject(sampleProject);
		setProject(nextProject);
		projectName = 'default-list';
		selectedEventId = `${nextProject.events[0]?.id ?? ''}`;
		selectedThemeId = thumbnailThemes[0]?.meta.id ?? '';
		openPersonId = nextProject.events[0]?.thumbnail.people[0]?.id ?? '';
		openEditorSection = 'content';
		openEditorSubsection = 'title';
	}

	function saveProjectJson() {
		const blob = new Blob([projectToJson(project)], { type: 'application/json' });
		triggerDownload(blob, `${projectName || 'ai-collective-events'}-thumbnail-project.json`);
	}

	function downloadSourceSchema() {
		const schemaJson = JSON.stringify(sourceEventsSchema, null, 2);
		const blob = new Blob([schemaJson], { type: 'application/schema+json' });
		triggerDownload(blob, 'source-events.schema.json');
	}

	async function exportCurrent(format: ExportFormat) {
		if (!activeEvent || !exportRenderNode) {
			return;
		}

		isExporting = true;
		exportError = '';
		exportMessage = `Exporting ${buildThumbnailFilename(activeEvent, format)}...`;
		exportSavedNotice = '';

		try {
			await tick();
			await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
			await downloadSingleThumbnail(exportRenderNode, activeEvent, format);
			exportMessage = '';
			showExportSavedNotice(`Saved ${format.toUpperCase()}`);
		} catch (error) {
			exportError =
				error instanceof Error ? error.message : 'The thumbnail could not be exported.';
			exportMessage = '';
		} finally {
			isExporting = false;
		}
	}

	async function exportAll(format: ExportFormat) {
		if (!exportRenderNode || project.events.length === 0) {
			return;
		}

		isExporting = true;
		exportError = '';
		const previousEventId = selectedEventId;
		const previousOpenPersonId = openPersonId;
		const entries: Array<{ filename: string; blob: Blob }> = [];

		try {
			for (const event of project.events) {
				selectedEventId = `${event.id}`;
				openPersonId = event.thumbnail.people[0]?.id ?? '';
				exportMessage = `Rendering ${buildThumbnailFilename(event, format)}...`;
				await tick();
				await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
				const blob = await renderThumbnailBlob(exportRenderNode, format);
				entries.push({
					filename: buildThumbnailFilename(event, format),
					blob
				});
			}

			exportMessage = 'Packaging ZIP archive...';
			await downloadZipFromBlobs(entries);
			exportMessage = `Saved ${entries.length} thumbnails to ZIP.`;
		} catch (error) {
			exportError =
				error instanceof Error ? error.message : 'The thumbnail archive could not be exported.';
			exportMessage = '';
		} finally {
			selectedEventId = previousEventId;
			openPersonId = previousOpenPersonId;
			isExporting = false;
		}
	}

	async function openPreviewModal() {
		if (!activeEvent || !exportRenderNode) {
			return;
		}

		closeMenus();
		isPreviewModalOpen = true;
	}

	async function renderPreviewModalImage() {
		if (!activeEvent || !exportRenderNode) {
			return;
		}

		previewModalEventId = `${activeEvent.id}`;
		isPreviewModalLoading = true;
		previewModalError = '';
		previewImageLoaded = false;

		try {
			await tick();
			await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
			setPreviewRenderResult(await renderThumbnailPreviewUrl(exportRenderNode));
		} catch (error) {
			setPreviewImageUrl('');
			previewImageLoaded = false;
			previewModalError =
				error instanceof Error ? error.message : 'The preview image could not be rendered.';
		} finally {
			isPreviewModalLoading = false;
		}
	}

	$effect(() => {
		if (!isPreviewModalOpen || !activeEvent || previewModalEventId === `${activeEvent.id}`) {
			return;
		}

		void renderPreviewModalImage();
	});

	function navigatePreviewModal(direction: -1 | 1) {
		if (isPreviewModalLoading) {
			return;
		}

		navigateEvent(direction);
	}

	function closePreviewModal() {
		isPreviewModalOpen = false;
		isPreviewModalLoading = false;
		previewModalError = '';
		previewImageLoaded = false;
		previewModalEventId = '';
		setPreviewImageUrl('');
	}
</script>

<div class="studio-shell">
	<main class="preview-workspace">
		<section class="panel-surface preview-panel-large">
			<div class="workspace-top">
				<div class="workspace-copy">
					<div class="menu-shell event-launcher-shell">
						<button
							class="event-launcher"
							type="button"
							aria-expanded={openAppMenu === 'events'}
							onclick={() => toggleAppMenu('events')}
						>
							<span>{activeEvent?.title ?? 'Select an event'}</span>
							<small>
								{activeEventIndex >= 0 ? activeEventIndex + 1 : 0} / {project.events.length} slides
							</small>
						</button>

						{#if openAppMenu === 'events'}
							<div class="floating-menu event-picker-menu">
								<label class="toolbar-field event-picker">
									<span>Editing</span>
									<select
										value={selectedEventId}
										onchange={(changeEvent) =>
											selectEvent((changeEvent.currentTarget as HTMLSelectElement).value)}
									>
										{#each project.events as event}
											<option value={`${event.id}`}>
												#{event.id} {event.title}
											</option>
										{/each}
									</select>
								</label>
								<p class="panel-caption">Choose a slide here, then use the inspector below to edit it.</p>
							</div>
						{/if}
					</div>
				</div>
				<div class="preview-toolbar">
					<div class="modal-navigation preview-navigation" aria-label="Slide navigation">
						<button
							class="nav-icon-button"
							type="button"
							onclick={() => navigateEvent(-1)}
							disabled={activeEventIndex <= 0}
							aria-label="Previous event"
						>
							<span aria-hidden="true">←</span>
						</button>
						<select
							class="modal-count nav-count-select"
							value={selectedEventId}
							onchange={(e) => selectEvent((e.currentTarget as HTMLSelectElement).value)}
							aria-label="Select event"
						>
							{#each project.events as event, i}
								<option value={`${event.id}`}>
									{i + 1}/{project.events.length} · {event.title.length > 26 ? event.title.slice(0, 26) + '…' : event.title}
								</option>
							{/each}
						</select>
						<button
							class="nav-icon-button"
							type="button"
							onclick={() => navigateEvent(1)}
							disabled={activeEventIndex < 0 || activeEventIndex >= project.events.length - 1}
							aria-label="Next event"
						>
							<span aria-hidden="true">→</span>
						</button>
					</div>
				</div>
			</div>

			<div class="preview-stage preview-stage-large" bind:this={previewViewport}>
				{#if activeEvent && activeTheme}
					<button
						type="button"
						class="preview-click-target"
						onclick={openPreviewModal}
						aria-label="Open rendered preview image"
					>
						<div class="preview-stage-inner" style={`height: ${CANVAS_HEIGHT * previewScale}px;`}>
							<div
								class="thumbnail-export-root"
								style={`transform: scale(${previewScale}); transform-origin: top left;`}
							>
								<activeTheme.component event={activeEvent} />
							</div>
						</div>
						<span class="preview-click-hint">Click preview to inspect the rendered image</span>
					</button>
				{:else}
					<div class="preview-empty">Upload or load JSON to begin.</div>
				{/if}
			</div>

			<div class="preview-footnotes">
				<p class="panel-caption">
					Exports use
					`{activeEvent ? buildThumbnailFilename(activeEvent, 'png') : 'id-event-name.png'}`.
				</p>
				<p class="panel-caption">
					AI Collective remote images are proxied at render time to keep logos and headshots exportable
					across more hosts.
				</p>
			</div>
		</section>
	</main>

	<aside class="editor-pane">
		<section class="panel-surface editor-panel">
			<div class="editor-head compact-editor-head">
				<div class="editor-appbar">
					<div class="editor-appbar-copy">
						<p class="sidebar-kicker">AI Collective Design System</p>
						<h1>Thumbnail Studio</h1>
					</div>

					<div class="editor-appbar-controls">
						<label class="toolbar-field theme-field">
							<select
								value={selectedThemeId}
								onchange={(changeEvent) =>
									updateProjectTheme((changeEvent.currentTarget as HTMLSelectElement).value)}
							>
								{#each thumbnailThemes as theme}
									<option value={theme.meta.id}>{theme.meta.name}</option>
								{/each}
							</select>
						</label>

						<div class="menu-shell">
							<button
								class="secondary-button compact-button"
								type="button"
								aria-expanded={openAppMenu === 'actions'}
								onclick={() => toggleAppMenu('actions')}
							>
								Actions
							</button>

							{#if openAppMenu === 'actions'}
								<div class="floating-menu action-menu">
									<label class="file-button menu-button">
										<input type="file" accept=".json,application/json" onchange={importJsonFile} />
										<span>Upload JSON</span>
									</label>
									<button class="menu-button" type="button" onclick={() => runMenuAction(addBlankEvent)}>
										New event
									</button>
									<button class="menu-button" type="button" onclick={() => runMenuAction(loadSampleProject)}>
										Load sample
									</button>
									<button class="menu-button" type="button" onclick={() => runMenuAction(saveProjectJson)}>
										Save JSON
									</button>
									<button class="menu-button" type="button" onclick={() => runMenuAction(downloadSourceSchema)}>
										Download schema
									</button>
								</div>
							{/if}
						</div>

						<div class="menu-shell">
							<button
								class="primary-button compact-button"
								type="button"
								aria-expanded={openAppMenu === 'export'}
								onclick={() => toggleAppMenu('export')}
								disabled={!activeEvent && project.events.length === 0}
							>
								Export
							</button>

							{#if openAppMenu === 'export'}
								<div class="floating-menu action-menu">
									<button
										class="menu-button"
										type="button"
										onclick={() => runMenuAction(() => exportCurrent('png'))}
										disabled={isExporting || !activeEvent}
									>
										Current PNG
									</button>
									<button
										class="menu-button"
										type="button"
										onclick={() => runMenuAction(() => exportCurrent('jpg'))}
										disabled={isExporting || !activeEvent}
									>
										Current JPG
									</button>
									<button
										class="menu-button"
										type="button"
										onclick={() => runMenuAction(() => exportAll('png'))}
										disabled={isExporting || project.events.length === 0}
									>
										All PNGs
									</button>
									<button
										class="menu-button"
										type="button"
										onclick={() => runMenuAction(() => exportAll('jpg'))}
										disabled={isExporting || project.events.length === 0}
									>
										All JPGs
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="export-status-row" aria-live="polite">
					{#if exportMessage}
						<p class="panel-caption export-status-text">{exportMessage}</p>
					{:else if exportSavedNotice}
						<p class="export-saved-pill">{exportSavedNotice}</p>
					{:else if activeEvent}
						<p class="panel-caption export-status-text">
							Exports current slide as `{buildThumbnailFilename(activeEvent, 'png')}` or `.jpg`.
						</p>
					{/if}
				</div>

				{#if !dev}
					<p class="read-only-notice">
						⚠ This is a published site, edits are not saved. To request changes, <a href="https://www.cambermast.com/contact" target="_blank" rel="noopener noreferrer">contact Bill Raymond</a>.
					</p>
				{/if}

				{#if importError}
					<div class="error-panel" role="alert" aria-live="polite">
						<p class="error-text">{importError}</p>
						{#if importErrorDetails.length > 0}
							<ul class="error-list">
								{#each importErrorDetails as detail}
									<li>{detail}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
				{#if exportError}
					<p class="error-text">{exportError}</p>
				{/if}
			</div>

			<div class="editor-body compact-editor-body">
				{#if activeEvent}
					<section class="event-summary-card">
						<div class="event-summary-compact">
							<div class="event-summary-main">
								<p class="panel-label">Current Event</p>
								<h2>{activeEvent.title}</h2>
							</div>
							<button
								class="ghost-button compact-button"
								type="button"
								aria-expanded={isEventSummaryExpanded}
								onclick={() => {
									isEventSummaryExpanded = !isEventSummaryExpanded;
								}}
							>
								{isEventSummaryExpanded ? 'Hide details' : 'Show details'}
							</button>
						</div>
						<div class="event-summary-meta">
							<span>#{activeEvent.id}</span>
							{#if activeEvent.day !== undefined && activeEvent.day !== null && `${activeEvent.day}`.trim() !== ''}
								<span>Day {activeEvent.day}</span>
							{/if}
							{#if activeTheme}
								<span>{activeTheme.meta.name}</span>
							{/if}
							<span>{activeEvent.thumbnail.people.length} people</span>
							<span>{activeOrgs.length} orgs</span>
						</div>

						{#if isEventSummaryExpanded}
							<div class="event-summary-expanded">
								{#if activeTheme}
									<p class="panel-caption">{activeTheme.meta.description}</p>
								{/if}
								<p class="panel-caption">
									Editing slide {activeEventIndex >= 0 ? activeEventIndex + 1 : 0} of {project.events.length}.
								</p>
							</div>
						{/if}
					</section>

					<div class="editor-toolbar compact-toolbar">
						<div class="section-tabs" role="tablist" aria-label="Editor sections">
							{#each visibleEditorSections as section}
								<button
									type="button"
									class:active={openEditorSection === section.id}
									class="section-tab"
									role="tab"
									aria-selected={openEditorSection === section.id}
									onclick={() => setEditorSection(section.id)}
								>
									{section.label}
								</button>
							{/each}
						</div>

						{#if visibleEditorSubsections.length > 1}
							<div class="subsection-tabs" role="tablist" aria-label="Editor subsections">
								{#each visibleEditorSubsections as subsection}
									<button
										type="button"
										class:active={openEditorSubsection === subsection.id}
										class="subsection-tab"
										role="tab"
										aria-selected={openEditorSubsection === subsection.id}
										onclick={() => setEditorSubsection(subsection.id)}
									>
										{subsection.label}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if openEditorSection === 'content'}
						<section class="editor-section">
							<div class="editor-section-head compact-section-head">
								<div>
									<p class="panel-label">Content</p>
									<h3>Primary title</h3>
								</div>
							</div>

							<div class="form-grid compact-form-grid">
								<label class="field-block field-block-full">
									<span>Event title</span>
									<input
										type="text"
										value={activeEvent.title}
										oninput={(inputEvent) =>
											updateActiveEventField(
												'title',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
										/>
								</label>

								<label class="field-block">
									<span>Type</span>
									<input
										type="text"
										value={activeEvent.type}
										oninput={(inputEvent) =>
											updateActiveEventField(
												'type',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>

								<label class="field-block">
									<span>Day</span>
									<input
										type="text"
										placeholder="e.g. 1"
										value={activeEvent.day ?? ''}
										oninput={(inputEvent) =>
											updateActiveEventField(
												'day',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>

								<label class="field-block">
									<span>Location</span>
									<input
										type="text"
										value={activeEvent.location ?? ''}
										oninput={(inputEvent) =>
											updateActiveEventField(
												'location',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>

								<label class="field-block field-block-full">
									<span>Location logo URL</span>
									<input
										type="url"
										value={activeEvent.location_logo_url}
										oninput={(inputEvent) =>
											updateActiveEventField(
												'location_logo_url',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
									/>
									<small>{statusLabel[getUrlStatus(activeEvent.location_logo_url ?? '')]}</small>
								</label>

								<label class="checkbox-field field-block-full">
									<input
										type="checkbox"
										checked={activeEvent.thumbnail.locationLogoHasBackground}
										onchange={(inputEvent) =>
											updateActiveThumbnailField(
												'locationLogoHasBackground',
												(inputEvent.currentTarget as HTMLInputElement).checked
											)}
									/>
									<span>White background behind location logo</span>
								</label>
							</div>
						</section>
					{:else if openEditorSection === 'style'}
						<section class="editor-section">
							<div class="editor-section-head compact-section-head">
								<div>
									<p class="panel-label">Style</p>
									<h3>{openEditorSubsection === 'overlays' ? 'Text overlays' : 'Image sources'}</h3>
								</div>
							</div>

							<div class="form-grid compact-form-grid">
								{#if openEditorSubsection === 'imagery'}
									{#if themeSupportsTextField('backgroundImageUrl')}
										<label class="field-block field-block-full">
											<span>Background image URL</span>
											<input
												type="url"
												value={activeEvent.thumbnail.backgroundImageUrl}
												oninput={(inputEvent) =>
													updateActiveThumbnailField(
														'backgroundImageUrl',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
											<small>{statusLabel[getUrlStatus(activeEvent.thumbnail.backgroundImageUrl)]}</small>
										</label>
									{/if}

									{#if themeSupportsTextField('eventLogoUrl')}
										<label class="field-block field-block-full">
											<span>Event logo URL</span>
											<input
												type="url"
												value={activeEvent.thumbnail.eventLogoUrl}
												oninput={(inputEvent) =>
													updateActiveThumbnailField(
														'eventLogoUrl',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
											<small>{statusLabel[getUrlStatus(activeEvent.thumbnail.eventLogoUrl)]}</small>
										</label>
									{/if}
								{:else}
									{#if themeSupportsTextField('producerCredit')}
										<label class="field-block">
											<span>Producer credit</span>
											<input
												type="text"
												value={activeEvent.thumbnail.producerCredit}
												oninput={(inputEvent) =>
													updateActiveThumbnailField(
														'producerCredit',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
										</label>
									{/if}

									{#if themeSupportsTextField('ctaText')}
										<label class="field-block">
											<span>CTA text</span>
											<input
												type="text"
												value={activeEvent.thumbnail.ctaText}
												oninput={(inputEvent) =>
													updateActiveThumbnailField(
														'ctaText',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
										</label>
									{/if}
								{/if}
							</div>
						</section>
					{:else if openEditorSection === 'people'}
						<section class="editor-section">
							<div class="editor-section-head compact-section-head">
								<div>
									<p class="panel-label">People</p>
									{#if openEditorSubsection !== 'roster'}
										<h3>Person details</h3>
									{/if}
								</div>
							</div>

							{#if openEditorSubsection === 'roster'}
								<div class="display-options-stack">
									<label class="checkbox-field display-option-field">
										<input
											type="checkbox"
											checked={activeEvent.thumbnail.capitalizePersonNames}
											onchange={(inputEvent) =>
												updateActiveThumbnailField(
													'capitalizePersonNames',
													(inputEvent.currentTarget as HTMLInputElement).checked
												)}
										/>
										<span>All-caps names</span>
									</label>

									<div class="display-option-actions">
										<button
											class="secondary-button compact-button display-option-action"
											type="button"
											onclick={() => addPerson('roster')}
										>
											<svg viewBox="0 0 24 24" aria-hidden="true">
												<path d="M12 5v14" />
												<path d="M5 12h14" />
											</svg>
											<span>Add</span>
										</button>

										{#if activePeopleOrderChanged}
											<button
												class="ghost-button compact-button display-option-action"
												type="button"
												onclick={resetPersonOrder}
											>
												<svg viewBox="0 0 24 24" aria-hidden="true">
													<path d="M4 7h11a5 5 0 1 1-3.5 8.5" />
													<path d="M4 7l4-4" />
													<path d="M4 7l4 4" />
												</svg>
												<span>Reset order</span>
											</button>
										{/if}
									</div>
								</div>

								{#if activeEvent.thumbnail.people.length > 0}
									<div class="people-roster" aria-label="People roster" role="list">
										{#each activeEvent.thumbnail.people as person (person.id)}
											<div
												class:active={person.id === openPersonId}
												class:dragging={draggedPersonId === person.id}
												class:drop-before={dragOverPersonId === person.id && dragOverPlacement === 'before'}
												class:drop-after={dragOverPersonId === person.id && dragOverPlacement === 'after'}
												class="person-roster-row"
												role="listitem"
												ondragover={(dragEvent) => updatePersonDropTarget(dragEvent, person.id)}
												ondrop={(dragEvent) => dropPerson(dragEvent, person.id)}
												ondragleave={() => {
													if (dragOverPersonId === person.id) {
														dragOverPersonId = '';
													}
												}}
											>
												<button
													class="person-drag-handle"
													type="button"
													draggable="true"
													aria-label={`Drag ${person.name || 'person'} to reorder`}
													title="Drag to reorder"
													ondragstart={(dragEvent) => startPersonDrag(dragEvent, person.id)}
													ondragend={clearPersonDrag}
												>
													<span aria-hidden="true">⋮⋮</span>
												</button>
												<label class="person-name-field">
													<span>Name</span>
													<input
														type="text"
														value={person.name}
														placeholder="New person"
														onfocus={() => (openPersonId = person.id)}
														oninput={(inputEvent) =>
															updatePersonField(
																person.id,
																'name',
																(inputEvent.currentTarget as HTMLInputElement).value
															)}
													/>
												</label>
												<div class="person-roster-meta">
													<span>{person.role || 'Panelist'}</span>
													{#if person.company}
														<span>{person.company}</span>
													{/if}
												</div>
												<div class="person-row-actions">
													<button
														class="nav-icon-button roster-icon-button"
														type="button"
														aria-label={`Edit ${person.name || 'person'} details`}
														title="Edit details"
														onclick={() => {
															openPersonId = person.id;
															setEditorSubsection('details');
														}}
													>
														<span class="roster-tooltip">Edit details</span>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path d="M4 20h4l11-11-4-4L4 16v4Z" />
															<path d="m14 6 4 4" />
														</svg>
													</button>
													<button
														class="nav-icon-button roster-icon-button"
														type="button"
														aria-label={`Remove ${person.name || 'person'}`}
														title="Remove"
														onclick={() => removePerson(person.id)}
													>
														<span class="roster-tooltip">Remove person</span>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path d="M4 7h16" />
															<path d="M10 11v6" />
															<path d="M14 11v6" />
															<path d="m6 7 1 14h10l1-14" />
															<path d="M9 7V4h6v3" />
														</svg>
													</button>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="editor-empty-state">
										<p>No people on this event yet.</p>
									</div>
								{/if}
							{:else if activePerson}
								<div class="form-grid compact-form-grid">
									{#if themeSupportsPersonField('role')}
										<label class="field-block">
											<span>Role</span>
											<input
												type="text"
												value={activePerson.role}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'role',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
										</label>
									{/if}

									{#if themeSupportsPersonField('name')}
										<label class="field-block">
											<span>Name</span>
											<input
												type="text"
												value={activePerson.name}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'name',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
										</label>
									{/if}

									{#if themeSupportsPersonField('company')}
										<label class="field-block field-block-full">
											<span>Company</span>
											<input
												type="text"
												value={activePerson.company}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'company',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
										</label>
									{/if}

									{#if themeSupportsPersonField('photoUrl')}
										<label class="field-block field-block-full">
											<span>Photo URL</span>
											<input
												type="url"
												value={activePerson.photoUrl}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'photoUrl',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
											<small>{statusLabel[getUrlStatus(activePerson.photoUrl)]}</small>
										</label>
									{/if}

									{#if themeSupportsPersonField('companyLogoUrl')}
										<label class="field-block field-block-full">
											<span>Company logo URL</span>
											<input
												type="url"
												value={activePerson.companyLogoUrl}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'companyLogoUrl',
														(inputEvent.currentTarget as HTMLInputElement).value
													)}
											/>
											<small>{statusLabel[getUrlStatus(activePerson.companyLogoUrl)]}</small>
										</label>
									{/if}

									{#if themeSupportsPersonField('companyLogoHasBackground')}
										<label class="checkbox-field field-block-full">
											<input
												type="checkbox"
												checked={activePerson.companyLogoHasBackground}
												onchange={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'companyLogoHasBackground',
														(inputEvent.currentTarget as HTMLInputElement).checked
													)}
											/>
											<span>White box behind logo</span>
										</label>
									{/if}

									{#if themeSupportsPersonField('photoPosition')}
										<label class="field-block">
											<span>Photo X</span>
											<input
												type="range"
												min="0"
												max="100"
												value={activePerson.photoPositionX}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'photoPositionX',
														Number((inputEvent.currentTarget as HTMLInputElement).value)
													)}
											/>
										</label>

										<label class="field-block">
											<span>Photo Y</span>
											<input
												type="range"
												min="0"
												max="100"
												value={activePerson.photoPositionY}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'photoPositionY',
														Number((inputEvent.currentTarget as HTMLInputElement).value)
													)}
											/>
										</label>
									{/if}

									{#if themeSupportsPersonField('logoScale')}
										<label class="field-block field-block-full">
											<span>Logo scale</span>
											<input
												type="range"
												min="50"
												max="150"
												value={activePerson.logoScale}
												oninput={(inputEvent) =>
													updatePersonField(
														activePerson.id,
														'logoScale',
														Number((inputEvent.currentTarget as HTMLInputElement).value)
													)}
											/>
										</label>
									{/if}
								</div>
							{:else}
								<div class="editor-empty-state">
									<p>No people on this event yet.</p>
									<button
										class="secondary-button compact-button"
										type="button"
										onclick={() => addPerson('details')}
									>
										Add first person
									</button>
								</div>
							{/if}
						</section>
					{:else}
						<section class="editor-section">
							<div class="editor-section-head compact-section-head">
								<div>
									<p class="panel-label">Orgs</p>
									<h3>Company logos</h3>
								</div>
							</div>

							<label class="checkbox-field display-option-field">
								<input
									type="checkbox"
									checked={activeEvent.thumbnail.capitalizeCompanyNames}
									onchange={(inputEvent) =>
										updateActiveThumbnailField(
											'capitalizeCompanyNames',
											(inputEvent.currentTarget as HTMLInputElement).checked
										)}
								/>
								<span>Capitalize org names in output</span>
							</label>

							{#if activeOrgs.length > 0}
								<div class="org-list">
									{#each activeOrgs as org (org.key)}
										<div class="org-row">
											<div class="org-row-head">
												<div>
													<p class="panel-label">Org</p>
													<h4>{org.company}</h4>
												</div>
												<span>{org.peopleCount} {org.peopleCount === 1 ? 'person' : 'people'}</span>
											</div>

											<div class="form-grid compact-form-grid">
												{#if themeSupportsPersonField('company')}
													<label class="field-block">
														<span>Company name</span>
														<input
															type="text"
															value={org.company}
															oninput={(inputEvent) =>
																updateOrgField(
																	org.key,
																	'company',
																	(inputEvent.currentTarget as HTMLInputElement).value
																)}
														/>
													</label>
												{/if}

												{#if themeSupportsPersonField('companyLogoUrl')}
													<label class="field-block">
														<span>Logo URL</span>
														<input
															type="url"
															value={org.companyLogoUrl}
															oninput={(inputEvent) =>
																updateOrgField(
																	org.key,
																	'companyLogoUrl',
																	(inputEvent.currentTarget as HTMLInputElement).value
																)}
														/>
														<small>{statusLabel[getUrlStatus(org.companyLogoUrl)]}</small>
													</label>
												{/if}

												{#if themeSupportsPersonField('companyLogoHasBackground')}
													<label class="checkbox-field field-block-full">
														<input
															type="checkbox"
															checked={org.companyLogoHasBackground}
															onchange={(inputEvent) =>
																updateOrgField(
																	org.key,
																	'companyLogoHasBackground',
																	(inputEvent.currentTarget as HTMLInputElement).checked
																)}
														/>
														<span>White box behind logo</span>
													</label>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="editor-empty-state">
									<p>No companies on this event yet.</p>
								</div>
							{/if}
						</section>
					{/if}
				{:else}
					<div class="editor-empty-state">
						<p>Upload or load JSON to begin.</p>
					</div>
				{/if}
			</div>
		</section>
	</aside>
</div>

{#if activeEvent && activeTheme}
	<div class="offscreen-render-shell" aria-hidden="true">
		{#key `${selectedThemeId}:${activeEvent.id}`}
			<div class="thumbnail-export-root" bind:this={exportRenderNode}>
				<activeTheme.component event={activeEvent} />
			</div>
		{/key}
	</div>
{/if}

{#if isPreviewModalOpen}
	<div class="modal-backdrop">
		<button
			type="button"
			class="modal-scrim"
			onclick={closePreviewModal}
			aria-label="Close rendered preview"
		></button>
		<div
			class="modal-dialog"
			role="dialog"
			aria-modal="true"
			aria-label="Rendered thumbnail preview"
			tabindex="-1"
		>
			<div class="modal-head">
				<div>
					<p class="panel-label">Rendered Image</p>
					<h3>{activeEvent?.title ?? 'Thumbnail preview'}</h3>
				</div>
				<div class="modal-head-actions">
					<div class="modal-navigation" aria-label="Rendered image navigation">
						<button
							class="nav-icon-button"
							type="button"
							onclick={() => navigatePreviewModal(-1)}
							disabled={isPreviewModalLoading || activeEventIndex <= 0}
							aria-label="Previous slide"
						>
							<span aria-hidden="true">←</span>
						</button>
						<select
							class="modal-count nav-count-select"
							value={selectedEventId}
							disabled={isPreviewModalLoading}
							onchange={(e) => selectEvent((e.currentTarget as HTMLSelectElement).value)}
							aria-label="Select slide"
						>
							{#each project.events as event, i}
								<option value={`${event.id}`}>
									{i + 1}/{project.events.length} · {event.title.length > 26 ? event.title.slice(0, 26) + '…' : event.title}
								</option>
							{/each}
						</select>
						<button
							class="nav-icon-button"
							type="button"
							onclick={() => navigatePreviewModal(1)}
							disabled={
								isPreviewModalLoading || activeEventIndex < 0 || activeEventIndex >= project.events.length - 1
							}
							aria-label="Next slide"
						>
							<span aria-hidden="true">→</span>
						</button>
					</div>
					<button class="ghost-button compact-button" type="button" onclick={closePreviewModal}>
						Close
					</button>
				</div>
			</div>

			<div class="modal-body">
				{#if isPreviewModalLoading}
					<div class="modal-status">Rendering preview image...</div>
				{:else if previewModalError}
					<div class="modal-status error-text">{previewModalError}</div>
				{:else if previewImageUrl}
					{#if previewImageKind === 'svg'}
						<object
							class="modal-image-object"
							data={previewImageUrl}
							type="image/svg+xml"
							aria-label={activeEvent?.title ?? 'Thumbnail preview'}
						>
							<div class="modal-status error-text">The generated SVG preview could not be displayed.</div>
						</object>
					{:else}
						<img
							class="modal-image"
							src={previewImageUrl}
							alt={activeEvent?.title ?? 'Thumbnail preview'}
							onload={() => {
								previewImageLoaded = true;
							}}
							onerror={() => {
								previewImageLoaded = false;
								previewModalError = 'The generated preview image was created, but the browser could not display it.';
							}}
						/>
						{#if !previewImageLoaded}
							<div class="modal-status">Loading rendered image...</div>
						{/if}
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
