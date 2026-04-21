<svelte:head>
	<title>AI Collective Thumbnail Studio</title>
	<meta
		name="description"
		content="Upload event JSON, edit speaker and brand details, preview the layout, and export AI Collective video thumbnails."
	/>
</svelte:head>

<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import sampleEvents from '../../ai_collective_events_enriched_with_ids_reordered.json';
	import { cloneProject, createEmptyPerson, normalizeProject, projectToJson } from '$lib/project';
	import { getTemplateById, thumbnailTemplates } from '$lib/templates';
	import {
		buildThumbnailFilename,
		downloadSingleThumbnail,
		downloadZipFromBlobs,
		renderThumbnailBlob,
		renderThumbnailPreviewUrl
	} from '$lib/export';
	import type { PreviewRenderResult } from '$lib/export';
	import type {
		ExportFormat,
		ImageStatus,
		ThumbnailEvent,
		ThumbnailPerson,
		ThumbnailProject
	} from '$lib/types';

	type EditorSection = 'event' | 'branding' | 'people';

	const sampleProject = normalizeProject(sampleEvents);
	const initialSelectedEventId = `${sampleProject.events[0]?.id ?? ''}`;
	const initialOpenPersonId = sampleProject.events[0]?.thumbnail.people[0]?.id ?? '';
	const editorSections: Array<{ id: EditorSection; label: string }> = [
		{ id: 'event', label: 'Event' },
		{ id: 'branding', label: 'Branding' },
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
	let projectName = $state('ai-collective-events');
	let openEditorSection = $state<EditorSection>('event');
	let openPersonId = $state<string>(initialOpenPersonId);
	let importError = $state('');
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

	function getActiveEvent() {
		return project.events.find((event) => `${event.id}` === selectedEventId) ?? project.events[0] ?? null;
	}

	function getActiveEventIndex() {
		return project.events.findIndex((event) => `${event.id}` === selectedEventId);
	}

	let activeEvent = $derived(getActiveEvent());
	let activeEventIndex = $derived(getActiveEventIndex());
	let activeTemplate = $derived(activeEvent ? getTemplateById(activeEvent.thumbnail.templateId) : null);
	let activePerson = $derived(
		activeEvent?.thumbnail.people.find((person) => person.id === openPersonId) ??
			activeEvent?.thumbnail.people[0] ??
			null
	);

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
			openPersonId = '';
			return;
		}

		selectedEventId = `${activeEvent.id}`;

		if (!activeEvent.thumbnail.people.some((person) => person.id === openPersonId)) {
			openPersonId = activeEvent.thumbnail.people[0]?.id ?? '';
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
	}

	function setEditorSection(section: EditorSection) {
		openEditorSection = section;
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

	function ensureUrlStatus(url: string) {
		if (!browser || !url || urlStatuses[url] === 'valid' || urlStatuses[url] === 'loading') {
			return;
		}

		markUrl(url, 'loading');
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => markUrl(url, 'valid');
		image.onerror = () => markUrl(url, 'failed');
		image.src = url;
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
			const normalized = normalizeProject(parsed);
			setProject(normalized);
			projectName = file.name.replace(/\.json$/i, '') || 'ai-collective-events';
			selectedEventId = `${normalized.events[0]?.id ?? ''}`;
			openPersonId = normalized.events[0]?.thumbnail.people[0]?.id ?? '';
			openEditorSection = 'event';
		} catch (error) {
			importError = error instanceof Error ? error.message : 'The JSON file could not be parsed.';
		} finally {
			input.value = '';
		}
	}

	function loadSampleProject() {
		const nextProject = cloneProject(sampleProject);
		setProject(nextProject);
		projectName = 'ai_collective_events_enriched_with_ids_reordered';
		selectedEventId = `${nextProject.events[0]?.id ?? ''}`;
		openPersonId = nextProject.events[0]?.thumbnail.people[0]?.id ?? '';
		openEditorSection = 'event';
	}

	function saveProjectJson() {
		const blob = new Blob([projectToJson(project)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${projectName || 'ai-collective-events'}-thumbnail-project.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1_000);
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

		isPreviewModalOpen = true;
		isPreviewModalLoading = true;
		previewModalError = '';

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

	function closePreviewModal() {
		isPreviewModalOpen = false;
		isPreviewModalLoading = false;
		previewModalError = '';
		previewImageLoaded = false;
		setPreviewImageUrl('');
	}
</script>

<div class="studio-shell">
	<aside class="editor-pane">
		<section class="panel-surface editor-panel">
			<div class="editor-head">
				<div class="editor-title-block">
					<p class="sidebar-kicker">AI Collective Design System</p>
					<h1>Thumbnail Studio</h1>
					<p class="sidebar-copy">
						Edit one slice at a time while the preview stays on screen.
					</p>
				</div>

				<div class="editor-actions">
					<label class="file-button compact-button">
						<input type="file" accept=".json,application/json" onchange={importJsonFile} />
						<span>Upload JSON</span>
					</label>
					<button class="secondary-button compact-button" type="button" onclick={loadSampleProject}>
						Load sample
					</button>
					<button class="secondary-button compact-button" type="button" onclick={saveProjectJson}>
						Save JSON
					</button>
					<button
						class="secondary-button compact-button"
						type="button"
						onclick={() => exportCurrent('png')}
						disabled={isExporting || !activeEvent}
					>
						Save PNG
					</button>
					<button
						class="secondary-button compact-button"
						type="button"
						onclick={() => exportCurrent('jpg')}
						disabled={isExporting || !activeEvent}
					>
						Save JPG
					</button>
					<button
						class="primary-button compact-button"
						type="button"
						onclick={() => exportAll('png')}
						disabled={isExporting || project.events.length === 0}
					>
						Save all PNGs
					</button>
				</div>

				{#if importError}
					<p class="error-text">{importError}</p>
				{/if}
				{#if exportMessage}
					<p class="panel-caption">{exportMessage}</p>
				{/if}
				{#if exportError}
					<p class="error-text">{exportError}</p>
				{/if}
			</div>

			<div class="editor-toolbar">
				<div class="event-navigation">
					<button
						class="nav-icon-button"
						type="button"
						onclick={() => navigateEvent(-1)}
						disabled={activeEventIndex <= 0}
						aria-label="Previous event"
					>
						<span aria-hidden="true">←</span>
					</button>

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

				<div class="section-tabs" role="tablist" aria-label="Editor sections">
					{#each editorSections as section}
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
			</div>

			<div class="event-summary">
				<div>
					<p class="panel-label">Current Event</p>
					<h2>{activeEvent?.title ?? 'Select an event'}</h2>
				</div>
				<div class="event-summary-meta">
					<span>#{activeEvent?.id ?? '–'}</span>
					{#if activeEvent?.day !== undefined && activeEvent?.day !== null && `${activeEvent.day}`.trim() !== ''}
						<span>Day {activeEvent.day}</span>
					{/if}
					{#if activeTemplate}
						<span>{activeTemplate.name}</span>
					{/if}
					{#if activeEvent}
						<span>{activeEvent.thumbnail.people.length} people</span>
					{/if}
				</div>
			</div>

			<div class="editor-body">
				{#if activeEvent}
					{#if openEditorSection === 'event'}
						<section class="editor-section">
							<div class="editor-section-head">
								<div>
									<p class="panel-label">Event</p>
									<h3>Title and structure</h3>
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

								<label class="field-block field-block-full">
									<span>Template</span>
									<select
										value={activeEvent.thumbnail.templateId}
										onchange={(changeEvent) =>
											updateActiveThumbnailField(
												'templateId',
												(changeEvent.currentTarget as HTMLSelectElement).value
											)}
									>
										{#each thumbnailTemplates as template}
											<option value={template.id}>{template.name}</option>
										{/each}
									</select>
								</label>

								<label class="field-block">
									<span>Variant label</span>
									<input
										type="text"
										value={activeEvent.thumbnail.variantLabel}
										oninput={(inputEvent) =>
											updateActiveThumbnailField(
												'variantLabel',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>

								<label class="field-block">
									<span>Eyebrow</span>
									<input
										type="text"
										value={activeEvent.thumbnail.eyebrow}
										oninput={(inputEvent) =>
											updateActiveThumbnailField(
												'eyebrow',
												(inputEvent.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
							</div>
						</section>
					{:else if openEditorSection === 'branding'}
						<section class="editor-section">
							<div class="editor-section-head">
								<div>
									<p class="panel-label">Branding</p>
									<h3>Background, logo, and CTA</h3>
								</div>
							</div>

							<div class="form-grid compact-form-grid">
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
							</div>
						</section>
					{:else}
						<section class="editor-section">
							<div class="editor-section-head">
								<div>
									<p class="panel-label">People</p>
									<h3>Focused person editor</h3>
								</div>
								<p class="panel-caption">
									Shared edits still sync automatically by exact name or company match.
								</p>
							</div>

							<div class="people-toolbar">
								<label class="toolbar-field person-picker">
									<span>Person</span>
									<select
										value={openPersonId}
										onchange={(changeEvent) => {
											openPersonId = (changeEvent.currentTarget as HTMLSelectElement).value;
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

								<div class="people-toolbar-actions">
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
								<div class="form-grid compact-form-grid">
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

	<main class="preview-workspace">
		<section class="panel-surface preview-panel-large">
			<div class="workspace-top">
				<div class="workspace-copy">
					<p class="workspace-kicker">Preview</p>
					<h2>{activeEvent?.title ?? 'Select an event'}</h2>
					<p>
						The preview stays visible while you edit. Click it any time to open the rendered
						image.
					</p>
				</div>
				<div class="preview-toolbar">
					<span class="panel-caption">1280×720 live canvas</span>
				</div>
			</div>

			<div class="preview-stage preview-stage-large" bind:this={previewViewport}>
				{#if activeEvent && activeTemplate}
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
								<activeTemplate.component event={activeEvent} />
							</div>
						</div>
						<span class="preview-click-hint">Open rendered image</span>
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
					Remote image URLs can preview successfully but still fail during browser export if the host
					disallows cross-origin rendering.
				</p>
			</div>
		</section>
	</main>
</div>

{#if activeEvent && activeTemplate}
	<div class="offscreen-render-shell" aria-hidden="true">
		<div class="thumbnail-export-root" bind:this={exportRenderNode}>
			<activeTemplate.component event={activeEvent} />
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
				<button class="ghost-button compact-button" type="button" onclick={closePreviewModal}>
					Close
				</button>
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
