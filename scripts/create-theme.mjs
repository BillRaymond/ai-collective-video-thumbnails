import { mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rawThemeId = process.argv[2]?.trim() ?? '';
const themeIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (!rawThemeId) {
	console.error('Usage: npm run theme:new -- <theme-id>');
	process.exit(1);
}

if (!themeIdPattern.test(rawThemeId)) {
	console.error('Theme IDs must be kebab-case and contain only lowercase letters, numbers, and hyphens.');
	process.exit(1);
}

const repoRoot = process.cwd();
const themeRoot = path.join(repoRoot, 'src', 'lib', 'themes', rawThemeId);

try {
	await access(themeRoot);
	console.error(`Theme already exists: ${themeRoot}`);
	process.exit(1);
} catch {
	// Continue when the directory does not exist.
}

const themeName = rawThemeId
	.split('-')
	.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
	.join(' ');

await mkdir(path.join(themeRoot, 'assets'), { recursive: true });

await Promise.all([
	writeFile(
		path.join(themeRoot, 'index.ts'),
		`import Theme from './Theme.svelte';
import { build${themeName.replace(/\s+/g, '')}Defaults } from './defaults';
import type { ThumbnailThemeDefinition } from '$lib/types';
import './theme.css';

export const assets = {};

export const theme: ThumbnailThemeDefinition = {
\tmeta: {
\t\tid: '${rawThemeId}',
\t\tname: '${themeName}',
\t\tdescription: 'Describe this theme here.'
\t},
\tcomponent: Theme,
\tdefaults: build${themeName.replace(/\s+/g, '')}Defaults,
\teditor: {
\t\teventFields: ['variantLabel', 'eyebrow'],
\t\tbrandingFields: ['backgroundImageUrl', 'eventLogoUrl', 'producerCredit', 'ctaText'],
\t\tpersonFields: ['role', 'name', 'company', 'photoUrl', 'companyLogoUrl', 'photoPosition', 'logoScale']
\t},
\tassets
};
`
	),
	writeFile(
		path.join(themeRoot, 'defaults.ts'),
		`import type { EventSource, ThumbnailConfig } from '$lib/types';

export function build${themeName.replace(/\s+/g, '')}Defaults(
\t_event: EventSource
): Partial<Omit<ThumbnailConfig, 'templateId' | 'people'>> {
\treturn {
\t\tvariantLabel: 'Panel Discussion',
\t\teyebrow: '',
\t\teventLogoUrl: '',
\t\tbackgroundImageUrl: '',
\t\tproducerCredit: '',
\t\tctaText: 'Watch Now'
\t};
}
`
	),
	writeFile(
		path.join(themeRoot, 'Theme.svelte'),
		`<script lang="ts">
\timport type { ThumbnailEvent } from '$lib/types';

\tlet { event }: { event: ThumbnailEvent } = $props();
</script>

<div class="${rawThemeId}-frame">
\t<div class="${rawThemeId}-content">
\t\t<p class="${rawThemeId}-eyebrow">{event.thumbnail.eyebrow || 'Theme eyebrow'}</p>
\t\t<h1 class="${rawThemeId}-title">{event.title}</h1>
\t\t<p class="${rawThemeId}-meta">
\t\t\t{event.thumbnail.variantLabel || 'Variant'} · {event.thumbnail.ctaText || 'Watch Now'}
\t\t</p>
\t</div>
</div>
`
	),
	writeFile(
		path.join(themeRoot, 'theme.css'),
		`.${rawThemeId}-frame {
\tposition: relative;
\twidth: 1280px;
\theight: 720px;
\tdisplay: grid;
\tplace-items: center;
\tpadding: 64px;
\toverflow: hidden;
\tbackground:
\t\tradial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 32%),
\t\tlinear-gradient(135deg, #0f172a 0%, #1e293b 100%);
\tcolor: white;
\tfont-family: var(--font-body);
}

.${rawThemeId}-content {
\twidth: 100%;
\tpadding: 48px;
\tborder: 1px solid rgba(255, 255, 255, 0.14);
\tborder-radius: 32px;
\tbackground: rgba(15, 23, 42, 0.72);
\tbackdrop-filter: blur(18px);
}

.${rawThemeId}-eyebrow {
\tmargin: 0 0 16px;
\tfont-size: 18px;
\tletter-spacing: 0.14em;
\ttext-transform: uppercase;
\tcolor: rgba(255, 255, 255, 0.72);
}

.${rawThemeId}-title {
\tmargin: 0;
\tfont-size: 72px;
\tline-height: 1.02;
\tletter-spacing: -0.04em;
\tfont-family: var(--font-display);
}

.${rawThemeId}-meta {
\tmargin: 18px 0 0;
\tfont-size: 26px;
\tcolor: rgba(255, 255, 255, 0.8);
}
`
	),
	writeFile(path.join(themeRoot, 'assets', '.gitkeep'), '')
]);

console.log(`Created theme scaffold at ${path.relative(repoRoot, themeRoot)}`);
