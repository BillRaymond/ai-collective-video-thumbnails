<svelte:head>
	<title>Start Here | SvelteKit Tailwind Pages Template</title>
	<meta
		name="description"
		content="Start from a neutral SvelteKit and Tailwind CSS template that is ready for GitHub Pages."
	/>
</svelte:head>

<script lang="ts">
	import { onMount } from 'svelte';
	import { withGsapContext } from '$lib';

	const commands = ['npm install', 'npm run dev', 'npm run check', 'npm run build'];

	let page: HTMLElement | undefined;

	onMount(() => {
		if (!page) {
			return;
		}

		return withGsapContext(page, (gsap) => {
			gsap.set('.js-gsap-command', { y: 10, opacity: 0 });

			gsap
				.timeline({ defaults: { ease: 'power2.out' } })
				.from('.js-gsap-eyebrow', { y: 22, opacity: 0, duration: 0.45 })
				.from('.js-gsap-title', { y: 30, opacity: 0, duration: 0.7 }, '-=0.2')
				.from('.js-gsap-copy', { y: 24, opacity: 0, duration: 0.55 }, '-=0.35')
				.from('.js-gsap-card', { y: 28, opacity: 0, duration: 0.55, stagger: 0.12 }, '-=0.25')
				.to(
					'.js-gsap-command',
					{ y: 0, opacity: 1, duration: 0.35, stagger: 0.08 },
					'-=0.35'
				);

			gsap.to('.js-weather-sun, .js-weather-rays', {
				rotate: 360,
				duration: 18,
				ease: 'none',
				repeat: -1,
				transformOrigin: 'center'
			});

			gsap.to('.js-weather-cloud', {
				x: 14,
				duration: 3.2,
				ease: 'sine.inOut',
				repeat: -1,
				yoyo: true
			});

			gsap.to('.js-weather-sparkle', {
				y: -6,
				opacity: 0.45,
				duration: 1.6,
				ease: 'sine.inOut',
				repeat: -1,
				yoyo: true,
				stagger: 0.18
			});
		});
	});
</script>

<div bind:this={page} class="min-h-screen bg-stone-50 text-stone-900">
	<div class="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16 sm:px-10 lg:px-12">
		<section class="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] lg:items-end">
			<div class="space-y-5">
				<p class="js-gsap-eyebrow text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">
					SvelteKit + Tailwind + GitHub Pages
				</p>
				<h1 class="js-gsap-title max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
					A neutral starter template you can fork, rename, and publish without cleanup first.
				</h1>
				<p class="js-gsap-copy max-w-2xl text-lg leading-8 text-stone-700">
					Replace this page with your content, keep the deployment workflow, and use the included
					dev container and Docker helpers if they fit your setup.
				</p>
			</div>

			<div class="js-gsap-card rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
				<p class="text-sm font-semibold text-stone-900">What ships in the template</p>
				<ul class="mt-4 space-y-3 text-sm leading-6 text-stone-700">
					<li>Static-site output with `@sveltejs/adapter-static`</li>
					<li>Tailwind CSS 4 and Svelte 5 ready to customize</li>
					<li>GSAP installed with a Svelte-friendly helper in `$lib`</li>
					<li>GitHub Pages deployment with base-path handling</li>
					<li>Optional VS Code Dev Container and local Docker scripts</li>
				</ul>
			</div>
		</section>

		<section class="grid gap-6 md:grid-cols-2">
			<div class="js-gsap-card rounded-3xl bg-stone-900 p-6 text-stone-100 shadow-sm">
				<p class="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">Quick start</p>
				<ul class="mt-4 space-y-3 font-mono text-sm">
					{#each commands as command}
						<li class="js-gsap-command">{command}</li>
					{/each}
				</ul>
			</div>

			<div class="js-gsap-card overflow-hidden rounded-[2rem] border border-amber-200/70 bg-linear-to-br from-amber-50 via-sky-50 to-cyan-100 p-6 shadow-sm">
				<div class="flex items-start justify-between gap-4">
					<div class="max-w-[18rem]">
						<p class="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
							Motion-ready with GSAP
						</p>
						<p class="mt-3 text-sm leading-6 text-stone-700">
							GSAP stands for GreenSock Animation Platform. It gives this site smooth,
							sequenced JavaScript animation beyond basic CSS transitions.
						</p>
					</div>

					<div class="relative h-28 w-32 shrink-0">
						<div class="js-weather-sparkle absolute left-2 top-6 h-2 w-2 rounded-full bg-white/80"></div>
						<div class="js-weather-sparkle absolute left-6 top-2 h-1.5 w-1.5 rounded-full bg-cyan-200"></div>
						<div class="js-weather-sparkle absolute right-3 top-10 h-2 w-2 rounded-full bg-amber-200/90"></div>

						<svg
							viewBox="0 0 160 140"
							class="absolute inset-0 h-full w-full drop-shadow-[0_14px_24px_rgba(251,191,36,0.22)]"
							aria-hidden="true"
						>
							<g class="js-weather-rays">
								{#each Array(8) as _, index}
									<rect
										x="77"
										y="8"
										width="6"
										height="18"
										rx="3"
										fill="#f59e0b"
										transform={`rotate(${index * 45} 80 58)`}
										opacity="0.8"
									/>
								{/each}
							</g>

							<circle class="js-weather-sun" cx="80" cy="58" r="28" fill="#fbbf24" />
							<circle class="js-weather-sun" cx="80" cy="58" r="18" fill="#fde68a" opacity="0.7" />

							<g class="js-weather-cloud">
								<ellipse cx="104" cy="92" rx="28" ry="16" fill="#ffffff" opacity="0.98" />
								<circle cx="86" cy="92" r="15" fill="#ffffff" opacity="0.98" />
								<circle cx="102" cy="82" r="18" fill="#ffffff" opacity="0.98" />
								<circle cx="122" cy="88" r="14" fill="#ffffff" opacity="0.98" />
							</g>
						</svg>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
