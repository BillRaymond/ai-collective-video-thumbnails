<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>SvelteKit Tailwind Pages Template</title>
	<meta
		name="description"
		content="A reusable SvelteKit, Tailwind CSS, and GitHub Pages starter template for static sites."
	/>
	<meta
		name="keywords"
		content="SvelteKit, Tailwind CSS, GitHub Pages, static site template"
	/>
	<meta property="og:title" content="SvelteKit Tailwind Pages Template" />
	<meta
		property="og:description"
		content="A reusable SvelteKit, Tailwind CSS, and GitHub Pages starter template for static sites."
	/>
	<meta property="og:type" content="website" />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
