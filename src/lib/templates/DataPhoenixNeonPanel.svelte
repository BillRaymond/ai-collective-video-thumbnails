<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { ThumbnailEvent, ThumbnailPerson } from '$lib/types';

	const TITLE_MAX_FONT_SIZE = 74;
	const TITLE_MIN_FONT_SIZE = 28;
	const TITLE_FIT_HEIGHT_RATIO = 0.98;
	const PHOENIX_BACKGROUND = '/data-phoenix-background.png';

	let { event }: { event: ThumbnailEvent } = $props();
	let titleBox: HTMLDivElement | null = null;
	let titleElement: HTMLHeadingElement | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let fitRequest = 0;
	let titleParts = $derived(splitTitleAccent(event.title));

	function getInitials(name: string) {
		const letters = name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');

		return letters || 'DP';
	}

	function personCountClass(people: ThumbnailPerson[]) {
		if (people.length <= 1) {
			return 'phoenix-count-1';
		}

		if (people.length <= 3) {
			return 'phoenix-count-3';
		}

		if (people.length <= 5) {
			return 'phoenix-count-5';
		}

		return 'phoenix-count-6plus';
	}

	function hasImageUrl(value: string) {
		return value.trim().length > 0;
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
		titleElement?.style.setProperty('--phoenix-title-size', `${size}px`);
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

<div class="phoenix-frame">
	<div class="phoenix-bg">
		<img src={PHOENIX_BACKGROUND} alt="" crossorigin="anonymous" />
	</div>

	<div class="phoenix-content">
		<div class="phoenix-title-column">
			<div class="phoenix-title-box" bind:this={titleBox}>
				<h1 class="phoenix-title" bind:this={titleElement}>
					{titleParts.prefix}
					{#if titleParts.accent}
						<span class="phoenix-title-accent">{titleParts.accent}</span>
					{/if}
				</h1>
			</div>
		</div>

		<div class="phoenix-lower">
			<div class="phoenix-people-wrap">
				<div class={`phoenix-people ${personCountClass(event.thumbnail.people)}`}>
					<div class="phoenix-people-title">{event.thumbnail.variantLabel}</div>

					{#if event.thumbnail.people.length === 0}
						<div class="phoenix-person phoenix-person-empty">
							<div class="phoenix-avatar phoenix-avatar-fallback">DP</div>
							<div class="phoenix-person-copy">
								<div class="phoenix-role">Speaker slot</div>
								<div class="phoenix-name">Add a speaker</div>
								<div class="phoenix-company">Use the editor to populate this session</div>
							</div>
						</div>
					{:else}
						{#each event.thumbnail.people as person (person.id)}
							<div class="phoenix-person">
								<div class="phoenix-avatar phoenix-avatar-fallback">{getInitials(person.name)}</div>

								<div class="phoenix-person-copy">
									<div class="phoenix-role">{person.role || 'Panelist'}</div>
									<div class="phoenix-name">{person.name || 'Unnamed speaker'}</div>
									<div class="phoenix-company">{person.company || 'Company name'}</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<div class="phoenix-meta-row">
				<div class="phoenix-footer-logo">
					{#if hasImageUrl(event.thumbnail.eventLogoUrl)}
						<img src={event.thumbnail.eventLogoUrl} alt="Event logo" crossorigin="anonymous" />
					{:else}
						<div class="phoenix-footer-mark">Add event logo</div>
					{/if}
				</div>

				<div class="phoenix-credit-pill">
					<span class="phoenix-credit">{event.thumbnail.producerCredit}</span>
				</div>

				<div class="phoenix-cta">
					<div class="phoenix-cta-icon">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path d="M4 2.5L13 8L4 13.5V2.5Z" fill="currentColor" />
						</svg>
					</div>
					<span class="phoenix-cta-text">{event.thumbnail.ctaText}</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.phoenix-frame {
		position: relative;
		width: 1280px;
		height: 720px;
		overflow: hidden;
		background: #130233;
		color: #f8f7ff;
	}

	.phoenix-bg,
	.phoenix-bg img {
		position: absolute;
		inset: 0;
	}

	.phoenix-bg img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.phoenix-content {
		position: absolute;
		inset: 0;
		padding: 24px 42px 34px;
	}

	.phoenix-role {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.phoenix-title-column {
		position: absolute;
		top: 24px;
		left: 9.5%;
		width: 81%;
		height: 116px;
	}

	.phoenix-title-box {
		width: 100%;
		height: 100%;
		overflow: hidden;
		padding: 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}

	.phoenix-title {
		margin: 0;
		font-family: var(--font-display);
		max-width: 100%;
		font-size: var(--phoenix-title-size, 74px);
		line-height: 0.92;
		letter-spacing: -0.03em;
		color: #fff8ff;
		text-align: center;
		text-wrap: balance;
		text-shadow:
			0 3px 8px rgba(7, 3, 22, 0.52),
			0 12px 28px rgba(3, 1, 14, 0.3);
	}

	.phoenix-title-accent {
		color: #a8f6ff;
	}

	.phoenix-lower {
		position: absolute;
		left: 0;
		width: 100%;
		bottom: 18px;
		display: grid;
		grid-template-rows: auto auto;
		gap: 14px;
	}

	.phoenix-footer-logo {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		min-height: 52px;
		padding: 14px 16px;
		border-radius: 18px;
		background: rgba(14, 10, 48, 0.5);
		border: 1px solid rgba(123, 140, 255, 0.22);
		backdrop-filter: blur(12px);
		box-shadow: 0 16px 28px rgba(5, 2, 18, 0.3);
	}

	.phoenix-footer-logo img {
		max-width: 100%;
		max-height: 30px;
		object-fit: contain;
	}

	.phoenix-footer-mark {
		font-size: 13px;
		color: rgba(231, 240, 255, 0.78);
	}

	.phoenix-people {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 8px;
		align-items: stretch;
		padding: 10px;
		border-radius: 22px;
		background: rgba(14, 9, 42, 0.76);
		border: 1px solid rgba(117, 143, 255, 0.22);
		backdrop-filter: blur(18px);
		box-shadow: 0 22px 36px rgba(4, 1, 15, 0.3);
	}

	.phoenix-people-wrap {
		width: 79.8%;
		margin: 0 auto;
	}

	.phoenix-people-title {
		grid-column: 1 / -1;
		margin: 0 0 2px;
		color: #d6fbff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.phoenix-person {
		display: grid;
		grid-template-columns: 46px minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		min-height: 62px;
		padding: 8px 10px;
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(46, 28, 98, 0.7), rgba(19, 11, 46, 0.92));
		border: 1px solid rgba(120, 196, 255, 0.2);
	}

	.phoenix-person-empty {
		border-style: dashed;
	}

	.phoenix-avatar {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.06);
	}

	.phoenix-avatar-fallback {
		background:
			radial-gradient(circle at 30% 25%, rgba(118, 243, 255, 0.24), transparent 42%),
			linear-gradient(160deg, rgba(53, 66, 144, 0.96), rgba(73, 21, 108, 0.96));
		font-size: 0.9rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		box-shadow: inset 0 0 0 1px rgba(131, 239, 255, 0.25);
	}

	.phoenix-person-copy {
		min-width: 0;
	}

	.phoenix-role {
		margin-bottom: 4px;
		color: #9aefff;
	}

	.phoenix-name {
		font-size: 17px;
		font-weight: 700;
		line-height: 1.05;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.phoenix-company {
		margin-top: 3px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: rgba(236, 238, 255, 0.8);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.phoenix-count-1 {
		grid-template-columns: minmax(240px, 320px);
		justify-content: center;
	}

	.phoenix-count-3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.phoenix-count-5 {
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}

	.phoenix-count-5 .phoenix-person {
		min-height: 64px;
	}

	.phoenix-count-5 .phoenix-name {
		font-size: 16px;
	}

	.phoenix-count-6plus {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.phoenix-count-6plus .phoenix-person {
		grid-template-columns: 40px minmax(0, 1fr);
		min-height: 54px;
		padding: 8px 10px;
	}

	.phoenix-count-6plus .phoenix-avatar {
		width: 40px;
		height: 40px;
	}

	.phoenix-count-6plus .phoenix-role,
	.phoenix-count-6plus .phoenix-company {
		font-size: 9px;
	}

	.phoenix-count-6plus .phoenix-name {
		font-size: 15px;
	}

	.phoenix-meta-row {
		display: grid;
		grid-template-columns: max-content 1fr max-content;
		align-items: end;
		width: calc(100% - 56px);
		margin: 0 auto;
		gap: 12px;
		padding: 0;
	}

	.phoenix-credit-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		justify-self: center;
		padding: 14px 16px;
		border-radius: 18px;
		background: rgba(14, 8, 38, 0.5);
		border: 1px solid rgba(131, 170, 255, 0.2);
		backdrop-filter: blur(10px);
		box-shadow: 0 12px 24px rgba(6, 2, 18, 0.26);
		text-align: center;
	}

	.phoenix-credit {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #ffffff;
	}

	.phoenix-cta {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		justify-self: end;
		gap: 12px;
		width: 156px;
		min-height: 58px;
		padding: 10px 16px 10px 10px;
		border-radius: 18px;
		background: rgba(9, 16, 56, 0.5);
		border: 1px solid rgba(106, 238, 255, 0.38);
		backdrop-filter: blur(10px);
		box-shadow: 0 14px 26px rgba(6, 3, 18, 0.28);
	}

	.phoenix-cta-icon {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: linear-gradient(145deg, #70f0ff, #d66eff);
		color: #130327;
	}

	.phoenix-cta-text {
		display: block;
		max-width: 78px;
		font-size: 18px;
		line-height: 1.06;
		font-weight: 500;
		white-space: normal;
	}
</style>
