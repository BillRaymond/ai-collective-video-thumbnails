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
	let personRows = $derived(splitPeopleIntoRows(event.thumbnail.people));

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

		if (people.length === 4) {
			return 'phoenix-count-4';
		}

		return 'phoenix-count-5plus';
	}

	function hasImageUrl(value: string) {
		return value.trim().length > 0;
	}

	function splitPeopleIntoRows(people: ThumbnailPerson[], maxPerRow = 3) {
		if (people.length === 0) {
			return [];
		}

		const rowCount = Math.ceil(people.length / maxPerRow);
		const baseRowSize = Math.floor(people.length / rowCount);
		const remainder = people.length % rowCount;
		const rows: ThumbnailPerson[][] = [];
		let start = 0;

		for (let index = 0; index < rowCount; index += 1) {
			const rowSize = baseRowSize + (index < remainder ? 1 : 0);
			rows.push(people.slice(start, start + rowSize));
			start += rowSize;
		}

		return rows;
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

						<div class="phoenix-people-grid">
							{#if event.thumbnail.people.length === 0}
								<div class="phoenix-people-row phoenix-row-count-1">
									<div class="phoenix-person phoenix-person-empty">
										<div class="phoenix-avatar phoenix-avatar-fallback">DP</div>
										<div class="phoenix-person-copy">
											<div class="phoenix-role">Speaker slot</div>
											<div class="phoenix-name">Add a speaker</div>
											<div class="phoenix-company">Use the editor to populate this session</div>
										</div>
									</div>
								</div>
							{:else}
								{#each personRows as row}
									<div class={`phoenix-people-row phoenix-row-count-${row.length}`}>
										{#each row as person (person.id)}
											<div class="phoenix-person">
												<div class="phoenix-role phoenix-person-role">{person.role || 'Panelist'}</div>
												<div class="phoenix-avatar phoenix-avatar-fallback">{getInitials(person.name)}</div>

												<div class="phoenix-person-copy">
													<div class="phoenix-name">{person.name || 'Unnamed speaker'}</div>
													<div class="phoenix-company">{person.company || 'Company name'}</div>
												</div>
											</div>
										{/each}
									</div>
								{/each}
							{/if}
						</div>
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
		line-height: 1.02;
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
		--phoenix-card-width: 320px;
		width: fit-content;
		max-width: 80%;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px;
		border-radius: 22px;
		background: rgba(14, 9, 42, 0.5);
		border: 1px solid rgba(117, 143, 255, 0.22);
		backdrop-filter: blur(12px);
		box-shadow: 0 22px 36px rgba(4, 1, 15, 0.3);
	}

	.phoenix-people-wrap {
		display: flex;
		justify-content: center;
		width: 100%;
		margin: 0 auto;
	}

	.phoenix-people-title {
		align-self: flex-start;
		margin: 0 0 2px;
		color: #d6fbff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.phoenix-people-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.phoenix-people-row {
		display: flex;
		justify-content: center;
		gap: 8px;
		width: 100%;
	}

	.phoenix-person {
		display: grid;
		flex: 0 0 var(--phoenix-card-width);
		width: var(--phoenix-card-width);
		max-width: 100%;
		min-width: 0;
		grid-template-columns: 46px minmax(0, 1fr);
		grid-template-areas:
			'role role'
			'avatar copy';
		align-items: center;
		column-gap: 10px;
		row-gap: 6px;
		min-height: 90px;
		padding: 9px 10px 10px;
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(46, 28, 98, 0.7), rgba(19, 11, 46, 0.92));
		border: 1px solid rgba(120, 196, 255, 0.2);
	}

	.phoenix-person-empty {
		border-style: dashed;
	}

	.phoenix-avatar {
		grid-area: avatar;
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
		grid-area: copy;
		min-width: 0;
	}

	.phoenix-role {
		color: #9aefff;
	}

	.phoenix-person-role {
		grid-area: role;
		margin: 0;
	}

	.phoenix-name {
		font-size: 19px;
		font-weight: 700;
		line-height: 1.05;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.phoenix-company {
		margin-top: 4px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: rgba(236, 238, 255, 0.8);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.phoenix-count-1 {
		--phoenix-card-width: 320px;
	}

	.phoenix-count-3 {
		--phoenix-card-width: 320px;
	}

	.phoenix-count-4 {
		--phoenix-card-width: 320px;
	}

	.phoenix-count-5plus {
		--phoenix-card-width: 320px;
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
		width: auto;
		min-width: 174px;
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
		font-size: 18px;
		line-height: 1.06;
		font-weight: 500;
		white-space: nowrap;
	}
</style>
