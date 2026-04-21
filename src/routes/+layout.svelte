<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>AI Collective Thumbnail Studio</title>
	<meta
		name="description"
		content="Upload event JSON, preview AI Collective video thumbnails, and export PNG or JPG renders."
	/>
	<meta name="keywords" content="AI Collective, thumbnails, SvelteKit, static app, JSON editor" />
	<meta property="og:title" content="AI Collective Thumbnail Studio" />
	<meta
		property="og:description"
		content="A static editor for AI Collective event thumbnails with upload, preview, and export tooling."
	/>
	<meta property="og:type" content="website" />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
