<script lang="ts">
	import backgroundImageUrl from './assets/humans-in-ai-week-background.png';
	import wordmarkUrl from '../ai-collective-panel-default/assets/Wordmark-White.png';
	import { resolveRenderableImageUrl } from '$lib/image';
	import { createImageFailureTracker, hasImageUrl } from '$lib/themes/theme-utils';
	import type { ThumbnailEvent, ThumbnailPerson } from '$lib/types';

	const THEME_ID = 'humans-in-ai-week';
	const DEFAULT_VARIANT_LABEL = 'Panel Discussion';

	let { event }: { event: ThumbnailEvent } = $props();
	let failedPhotoKeys = $state<Record<string, boolean>>({});
	let failedCompanyLogoKeys = $state<Record<string, boolean>>({});
	let eventLogoFailed = $state(false);
	const photoFailureTracker = createImageFailureTracker({
		getFailures: () => failedPhotoKeys,
		setFailures: (next) => (failedPhotoKeys = next),
		getKey: (person: ThumbnailPerson) => `${person.id}:${person.photoUrl.trim()}`
	});
	const companyLogoFailureTracker = createImageFailureTracker({
		getFailures: () => failedCompanyLogoKeys,
		setFailures: (next) => (failedCompanyLogoKeys = next),
		getKey: (person: ThumbnailPerson) => `${person.id}:${person.companyLogoUrl.trim()}`
	});

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

	function getImageSrc(value: string) {
		return resolveRenderableImageUrl(value, THEME_ID);
	}

	function isPersonPhotoFailed(person: ThumbnailPerson) {
		return photoFailureTracker.isFailed(person);
	}

	function isPersonCompanyLogoFailed(person: ThumbnailPerson) {
		return companyLogoFailureTracker.isFailed(person);
	}

	function markPersonPhotoFailed(person: ThumbnailPerson) {
		photoFailureTracker.markFailed(person);
	}

	function markPersonCompanyLogoFailed(person: ThumbnailPerson) {
		companyLogoFailureTracker.markFailed(person);
	}

	function clearPersonPhotoFailed(person: ThumbnailPerson) {
		photoFailureTracker.clearFailed(person);
	}

	function clearPersonCompanyLogoFailed(person: ThumbnailPerson) {
		companyLogoFailureTracker.clearFailed(person);
	}

	function shouldRenderCompanyLogo(person: ThumbnailPerson) {
		return hasImageUrl(person.companyLogoUrl) && !isPersonCompanyLogoFailed(person);
	}

	function getDisplayPersonName(person: ThumbnailPerson) {
		const name = person.name || 'Unnamed speaker';
		return event.thumbnail.capitalizePersonNames ? name.toUpperCase() : name;
	}

	function getDisplayCompanyName(person: ThumbnailPerson) {
		const company = person.company || ' ';
		return event.thumbnail.capitalizeCompanyNames ? company.toUpperCase() : company;
	}

	function shouldRenderEventLogo() {
		return hasImageUrl(getLocationLogoUrl()) && !eventLogoFailed;
	}

	function getLocationLogoUrl() {
		return event.location_logo_url || event.thumbnail.eventLogoUrl;
	}

	function getLocationLabel() {
		return event.location ?? '';
	}

	function getTypeLabel() {
		return event.type || DEFAULT_VARIANT_LABEL;
	}

	function getLogoBackgroundPadding(logoScale: number) {
		return 100 / Math.max(logoScale, 1);
	}
</script>

<div class="thumbnail-frame humans-in-ai-week-theme">
	<div class="thumbnail-bg">
		<img src={backgroundImageUrl} alt="" crossorigin="anonymous" />
	</div>

	<div class="thumbnail-content">
		<div class="thumbnail-top">
			<div class="brand-lockup">
				<img class="brand-wordmark" src={wordmarkUrl} alt="The AI Collective" />
			</div>
			<div class="badge-pill">
				<div class="badge-pill-dot"></div>
				<span>{getTypeLabel()}</span>
			</div>
		</div>

			<div class="thumbnail-main">
			<div class="title-column" aria-hidden="true"></div>

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
								<div class="speaker-name">{getDisplayPersonName(person)}</div>
								<div class="speaker-company">{getDisplayCompanyName(person)}</div>
							</div>

							{#if shouldRenderCompanyLogo(person)}
								<div class="speaker-logo-wrap">
									<div
										class="speaker-logo-scale"
										style={`--logo-bg-padding: ${getLogoBackgroundPadding(person.logoScale)}px; transform: scale(${person.logoScale / 100});`}
									>
										<img
											class="speaker-logo"
											src={getImageSrc(person.companyLogoUrl)}
											alt={person.company || 'Company logo'}
											crossorigin="anonymous"
											data-load-failed={isPersonCompanyLogoFailed(person) ? 'true' : undefined}
											onload={() => clearPersonCompanyLogoFailed(person)}
											onerror={() => markPersonCompanyLogoFailed(person)}
										/>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div class="thumbnail-bottom">
			<div class="event-lockup">
				<div class="event-lockup-label">Location</div>
				<div class="event-lockup-logo">
					{#if shouldRenderEventLogo()}
						<img
							class:location-logo-has-background={event.thumbnail.locationLogoHasBackground}
							src={getImageSrc(getLocationLogoUrl())}
							alt={getLocationLabel()}
							crossorigin="anonymous"
							data-load-failed={eventLogoFailed ? 'true' : undefined}
							onload={() => (eventLogoFailed = false)}
							onerror={() => (eventLogoFailed = true)}
						/>
					{:else}
						{#if !hasImageUrl(getLocationLogoUrl())}
							<div class="event-lockup-placeholder">{getLocationLabel()}</div>
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
