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
	import { resolveRenderableImageUrl } from '$lib/image';
	import {
		applyThemeToProject,
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

	type EditorSection = 'content' | 'style' | 'people';
	type EditorSubsection =
		| 'title'
		| 'imagery'
		| 'overlays'
		| 'roster'
		| 'details';
	type AppMenu = 'none' | 'actions' | 'export' | 'events';

	const sampleProject = parseProjectImport(sampleEvents);
	const initialSelectedEventId = `${sampleProject.events[0]?.id ?? ''}`;
	const initialOpenPersonId = sampleProject.events[0]?.thumbnail.people[0]?.id ?? '';
	const initialThemeId = thumbnailThemes[0]?.meta.id ?? '';
	const editorSections: Array<{ id: EditorSection; label: string }> = [
		{ id: 'content', label: 'Content' },
		{ id: 'style', label: 'Style' },
		{ id: 'people', label: 'People' }
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

			return activeTheme.editor.personFields.length > 0;
		})
	);
	let activePerson = $derived(
		activeEvent?.thumbnail.people.find((person) => person.id === openPersonId) ??
			activeEvent?.thumbnail.people[0] ??
			null
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

		return [
			{ id: 'roster', label: 'Roster' },
			{ id: 'details', label: 'Details' }
		];
	}

	function toggleAppMenu(menu: Exclude<AppMenu, 'none'>) {
		openAppMenu = openAppMenu === menu ? 'none' : menu;
	}

	function closeMenus() {
		openAppMenu = 'none';
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
		};
	});

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
		previewScale = Math.min(Math.max((width - 24) / 1280, 0.2), 1);
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

	function updatePersonField(personId: string, field: keyof ThumbnailPerson, value: string | number) {
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

		updatePersonLocal(personId, (person) => ({ ...person, [field]: value }));
	}

	function updateActiveEventField(field: keyof ThumbnailEvent, value: string) {
		if (!activeEvent || field !== 'title') {
			return;
		}

		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			title: value
		}));
	}

	function updateActiveThumbnailField(field: keyof ThumbnailEvent['thumbnail'], value: string) {
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
		openEditorSection = section;
		openEditorSubsection = getEditorSubsections(section)[0]?.id ?? 'title';
	}

	function setEditorSubsection(subsection: EditorSubsection) {
		openEditorSubsection = subsection;
	}

	function navigateEvent(direction: -1 | 1) {
		if (activeEventIndex < 0) {
			return;
		}

		const nextIndex = activeEventIndex + direction;
		if (nextIndex < 0 || nextIndex >= project.events.length) {
			return;
		}

		selectEvent(`${project.events[nextIndex]?.id ?? ''}`);
	}

	function addPerson() {
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
		openEditorSubsection = 'details';
		openPersonId = newPerson.id;
	}

	function removePerson(personId: string) {
		if (!activeEvent) {
			return;
		}

		const remainingPeople = activeEvent.thumbnail.people.filter((person) => person.id !== personId);
		updateEvent(`${activeEvent.id}`, (event) => ({
			...event,
			thumbnail: {
				...event.thumbnail,
				people: remainingPeople
			}
		}));
		openPersonId = remainingPeople[0]?.id ?? '';
	}

	function markUrl(url: string, status: ImageStatus) {
		if (!url) {
			return;
		}

		urlStatuses = { ...urlStatuses, [url]: status };
	}

	function getRenderableUrl(url: string) {
		if (!activeTheme) {
			return url;
		}

		return resolveRenderableImageUrl(url, activeTheme.meta.id);
	}

	function ensureUrlStatus(url: string) {
		if (!browser || !url || urlStatuses[url] === 'valid' || urlStatuses[url] === 'loading') {
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
			...activeEvent.thumbnail.people.flatMap((person) => [person.photoUrl, person.companyLogoUrl])
		].filter(Boolean);

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

	async function exportCurrent(format: ExportFormat) {
		if (!activeEvent || !exportRenderNode) {
			return;
		}

		isExporting = true;
		exportError = '';
		exportMessage = `Exporting ${buildThumbnailFilename(activeEvent, format)}...`;

		try {
			await tick();
			await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
			await downloadSingleThumbnail(exportRenderNode, activeEvent, format);
			exportMessage = `Saved ${buildThumbnailFilename(activeEvent, format)}.`;
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
						<div class="preview-stage-inner" style={`height: ${720 * previewScale}px;`}>
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
									<button class="menu-button" type="button" onclick={loadSampleProject}>
										Load sample
									</button>
									<button class="menu-button" type="button" onclick={saveProjectJson}>
										Save JSON
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
										onclick={() => exportCurrent('png')}
										disabled={isExporting || !activeEvent}
									>
										Current PNG
									</button>
									<button
										class="menu-button"
										type="button"
										onclick={() => exportCurrent('jpg')}
										disabled={isExporting || !activeEvent}
									>
										Current JPG
									</button>
									<button
										class="menu-button"
										type="button"
										onclick={() => exportAll('png')}
										disabled={isExporting || project.events.length === 0}
									>
										All PNGs
									</button>
									<button
										class="menu-button"
										type="button"
										onclick={() => exportAll('jpg')}
										disabled={isExporting || project.events.length === 0}
									>
										All JPGs
									</button>
								</div>
							{/if}
						</div>
					</div>
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
				{#if exportMessage}
					<p class="panel-caption">{exportMessage}</p>
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
					{:else}
						<section class="editor-section">
							<div class="editor-section-head compact-section-head">
								<div>
									<p class="panel-label">People</p>
									<h3>{openEditorSubsection === 'roster' ? 'Roster and focus' : 'Focused person editor'}</h3>
								</div>
								<p class="panel-caption">
									Shared edits still sync automatically by exact name or company match.
								</p>
							</div>

							{#if openEditorSubsection === 'roster'}
								<div class="people-toolbar compact-people-toolbar">
									<label class="toolbar-field person-picker">
										<span>Person</span>
										<select
											value={openPersonId}
											onchange={(changeEvent) => {
												openPersonId = (changeEvent.currentTarget as HTMLSelectElement).value;
												openEditorSubsection = 'details';
											}}
											disabled={activeEvent.thumbnail.people.length === 0}
										>
											{#each activeEvent.thumbnail.people as person}
												<option value={person.id}>
													{person.name || 'New person'} · {person.role || 'Panelist'}
												</option>
											{/each}
										</select>
									</label>

									<div class="people-toolbar-actions compact-people-actions">
										<button class="secondary-button compact-button" type="button" onclick={addPerson}>
											Add person
										</button>
										<button
											class="ghost-button compact-button"
											type="button"
											onclick={() => activePerson && removePerson(activePerson.id)}
											disabled={!activePerson}
										>
											Remove
										</button>
									</div>
								</div>

								{#if activePerson}
									<div class="focused-person-summary">
										<p class="panel-caption">
											Editing {activePerson.name || 'new person'} with {activePerson.role || 'no role yet'}.
										</p>
										<button
											class="secondary-button compact-button"
											type="button"
											onclick={() => setEditorSubsection('details')}
										>
											Edit details
										</button>
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
									<button class="secondary-button compact-button" type="button" onclick={addPerson}>
										Add first person
									</button>
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
		<div class="thumbnail-export-root" bind:this={exportRenderNode}>
			<activeTheme.component event={activeEvent} />
		</div>
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
