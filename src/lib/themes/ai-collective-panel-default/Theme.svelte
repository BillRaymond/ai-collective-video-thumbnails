<script lang="ts">
	import { onMount, tick } from 'svelte';
	import wordmarkUrl from './assets/Wordmark-White.png';
	import { resolveRenderableImageUrl } from '$lib/image';
	import type { ThumbnailEvent, ThumbnailPerson } from '$lib/types';

	const THEME_ID = 'ai-collective-panel-default';

	const TITLE_MAX_FONT_SIZE = 84;
	const TITLE_MIN_FONT_SIZE = 24;
	const TITLE_FIT_HEIGHT_RATIO = 0.98;

	let { event }: { event: ThumbnailEvent } = $props();
	let titleBox: HTMLDivElement | null = null;
	let titleElement: HTMLHeadingElement | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let fitRequest = 0;
	let failedPhotoKeys = $state<Record<string, boolean>>({});
	let failedCompanyLogoKeys = $state<Record<string, boolean>>({});
	let eventLogoFailed = $state(false);
	let titleParts = $derived(splitTitleAccent(event.title));

	function getInitials(name: string) {
		const letters = name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');

		return letters || 'AI';
	}

	function personCountClass(people: ThumbnailPerson[]) {
		if (people.length <= 3) {
			return `speaker-count-${Math.max(people.length, 1)}`;
		}

		if (people.length <= 5) {
			return `speaker-count-${people.length}`;
		}

		return 'speaker-count-6plus';
	}

	function hasImageUrl(value: string) {
		return value.trim().length > 0;
	}

	function getImageSrc(value: string) {
		return resolveRenderableImageUrl(value, THEME_ID);
	}

	function getPersonPhotoKey(person: ThumbnailPerson) {
		return `${person.id}:${person.photoUrl.trim()}`;
	}

	function getPersonCompanyLogoKey(person: ThumbnailPerson) {
		return `${person.id}:${person.companyLogoUrl.trim()}`;
	}

	function isPersonPhotoFailed(person: ThumbnailPerson) {
		return Boolean(failedPhotoKeys[getPersonPhotoKey(person)]);
	}

	function isPersonCompanyLogoFailed(person: ThumbnailPerson) {
		return Boolean(failedCompanyLogoKeys[getPersonCompanyLogoKey(person)]);
	}

	function markPersonPhotoFailed(person: ThumbnailPerson) {
		const key = getPersonPhotoKey(person);
		failedPhotoKeys = { ...failedPhotoKeys, [key]: true };
	}

	function markPersonCompanyLogoFailed(person: ThumbnailPerson) {
		const key = getPersonCompanyLogoKey(person);
		failedCompanyLogoKeys = { ...failedCompanyLogoKeys, [key]: true };
	}

	function clearPersonPhotoFailed(person: ThumbnailPerson) {
		const key = getPersonPhotoKey(person);

		if (!failedPhotoKeys[key]) {
			return;
		}

		const { [key]: _, ...rest } = failedPhotoKeys;
		failedPhotoKeys = rest;
	}

	function clearPersonCompanyLogoFailed(person: ThumbnailPerson) {
		const key = getPersonCompanyLogoKey(person);

		if (!failedCompanyLogoKeys[key]) {
			return;
		}

		const { [key]: _, ...rest } = failedCompanyLogoKeys;
		failedCompanyLogoKeys = rest;
	}

	function shouldRenderCompanyLogo(person: ThumbnailPerson) {
		return hasImageUrl(person.companyLogoUrl) && !isPersonCompanyLogoFailed(person);
	}

	function shouldRenderEventLogo() {
		return hasImageUrl(event.thumbnail.eventLogoUrl) && !eventLogoFailed;
	}

	function splitTitleAccent(title: string) {
		const match = title.match(/^(.*?[?:]\s+)(\S[\s\S]*)$/);

		if (!match) {
			return {
				prefix: title,
				accent: ''
			};
		}

		return {
			prefix: match[1],
			accent: match[2]
		};
	}

	function applyTitleSize(size: number) {
		titleElement?.style.setProperty('--thumbnail-title-size', `${size}px`);
	}

	function fitTitleToBounds() {
		if (!titleBox || !titleElement) {
			return;
		}

		const availableWidth = Math.floor(titleBox.clientWidth);
		const availableHeight = Math.floor(titleBox.clientHeight * TITLE_FIT_HEIGHT_RATIO);

		if (availableWidth <= 0 || availableHeight <= 0) {
			return;
		}

		let low = TITLE_MIN_FONT_SIZE;
		let high = TITLE_MAX_FONT_SIZE;
		let best = TITLE_MIN_FONT_SIZE;

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			applyTitleSize(mid);

			const fits =
				titleElement.scrollWidth <= availableWidth + 1 &&
				titleElement.scrollHeight <= availableHeight;

			if (fits) {
				best = mid;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		applyTitleSize(best);
	}

	function scheduleTitleFit() {
		cancelAnimationFrame(fitRequest);
		fitRequest = requestAnimationFrame(() => {
			fitTitleToBounds();
		});
	}

	onMount(() => {
		resizeObserver = new ResizeObserver(() => {
			scheduleTitleFit();
		});

		if (titleBox) {
			resizeObserver.observe(titleBox);
		}

		scheduleTitleFit();

		document.fonts?.ready.then(() => {
			scheduleTitleFit();
		});

		return () => {
			cancelAnimationFrame(fitRequest);
			resizeObserver?.disconnect();
		};
	});

	$effect(() => {
		event.title;
		tick().then(() => {
			scheduleTitleFit();
		});
	});
</script>

<div class="thumbnail-frame">
	<div class="thumbnail-bg">
		{#if hasImageUrl(event.thumbnail.backgroundImageUrl)}
			<img src={getImageSrc(event.thumbnail.backgroundImageUrl)} alt="" crossorigin="anonymous" />
		{/if}
	</div>
	<div class="thumbnail-overlay"></div>
	<div class="thumbnail-grain"></div>

	<div class="thumbnail-content">
		<div class="thumbnail-top">
			<div class="brand-lockup">
				<img class="brand-wordmark" src={wordmarkUrl} alt="The AI Collective" />
			</div>
			<div class="badge-pill">
				<div class="badge-pill-dot"></div>
				<span>{event.thumbnail.variantLabel}</span>
			</div>
		</div>

		<div class="thumbnail-main">
			<div class="title-column">
				<p class="thumbnail-eyebrow">{event.thumbnail.eyebrow}</p>
				<div class="thumbnail-title-box" bind:this={titleBox}>
					<h1 class="thumbnail-title" bind:this={titleElement}>
						{titleParts.prefix}
						{#if titleParts.accent}
							<span class="thumbnail-title-accent">{titleParts.accent}</span>
						{/if}
					</h1>
				</div>
			</div>

			<div class={`people-column ${personCountClass(event.thumbnail.people)}`}>
				{#if event.thumbnail.people.length === 0}
					<div class="speaker-card speaker-card-empty">
						<div class="speaker-avatar speaker-avatar-fallback">AI</div>
						<div class="speaker-copy">
							<div class="speaker-role">Add a speaker</div>
							<div class="speaker-name">Use the editor to add people</div>
							<div class="speaker-company">Preview updates live</div>
						</div>
					</div>
				{:else}
					{#each event.thumbnail.people as person (person.id)}
						<div class="speaker-card">
							<div class={`speaker-avatar ${isPersonPhotoFailed(person) ? 'photo-failed' : ''}`}>
								{#if hasImageUrl(person.photoUrl)}
									<div class="speaker-avatar-fallback">{getInitials(person.name)}</div>
									<img
										src={getImageSrc(person.photoUrl)}
										alt={person.name || 'Speaker photo'}
										crossorigin="anonymous"
										data-load-failed={isPersonPhotoFailed(person) ? 'true' : undefined}
										style={`object-position: ${person.photoPositionX}% ${person.photoPositionY}%;`}
										onload={() => clearPersonPhotoFailed(person)}
										onerror={() => markPersonPhotoFailed(person)}
									/>
								{:else}
									<div class="speaker-avatar-fallback">{getInitials(person.name)}</div>
								{/if}
							</div>

							<div class="speaker-copy">
								<div class="speaker-role">{person.role || 'Panelist'}</div>
								<div class="speaker-name">{person.name || 'Unnamed speaker'}</div>
								<div class="speaker-company">{person.company || 'Company name'}</div>
							</div>

							{#if shouldRenderCompanyLogo(person)}
								<div class="speaker-logo-wrap">
									<img
										class="speaker-logo"
										src={getImageSrc(person.companyLogoUrl)}
										alt={person.company || 'Company logo'}
										crossorigin="anonymous"
										data-load-failed={isPersonCompanyLogoFailed(person) ? 'true' : undefined}
										style={`transform: scale(${person.logoScale / 100});`}
										onload={() => clearPersonCompanyLogoFailed(person)}
										onerror={() => markPersonCompanyLogoFailed(person)}
									/>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div class="thumbnail-bottom">
			<div class="event-lockup">
				<div class="event-lockup-label">Presented at</div>
				<div class="event-lockup-logo">
					{#if shouldRenderEventLogo()}
						<img
							src={getImageSrc(event.thumbnail.eventLogoUrl)}
							alt="Event logo"
							crossorigin="anonymous"
							data-load-failed={eventLogoFailed ? 'true' : undefined}
							onload={() => (eventLogoFailed = false)}
							onerror={() => (eventLogoFailed = true)}
						/>
					{:else}
						{#if !hasImageUrl(event.thumbnail.eventLogoUrl)}
							<div class="event-lockup-placeholder">Add event logo</div>
						{/if}
					{/if}
				</div>
			</div>

			<div class="producer-credit">
				<div class="producer-credit-label">Produced by</div>
				<div class="producer-credit-text">{event.thumbnail.producerCredit}</div>
			</div>

			<div class="cta-pill">
				<div class="cta-pill-icon">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path d="M4 2.5L13 8L4 13.5V2.5Z" fill="white" />
					</svg>
				</div>
				<span>{event.thumbnail.ctaText}</span>
			</div>
		</div>
	</div>
</div>
