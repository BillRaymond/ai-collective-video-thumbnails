import type { ExportFormat, ThumbnailEvent } from './types';

type ExportableNode = HTMLElement;
export type PreviewRenderResult = {
	url: string;
	kind: 'raster' | 'svg';
};

type RenderOptions = {
	cacheBust?: boolean;
	pixelRatio?: number;
	width?: number;
	height?: number;
	canvasWidth?: number;
	canvasHeight?: number;
	backgroundColor?: string;
	imagePlaceholder?: string;
	filter?: (node: Node) => boolean;
};

const TRANSPARENT_IMAGE_PLACEHOLDER =
	'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

const HTML_TO_IMAGE_URLS = [
	'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.min.js',
	'https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.min.js'
];

const JSZIP_URLS = [
	'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
	'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
];

function slugify(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function appendScript(src: string) {
	return new Promise<void>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

		if (existing) {
			if (existing.dataset.loaded === 'true') {
				resolve();
				return;
			}

			existing.addEventListener('load', () => resolve(), { once: true });
			existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
				once: true
			});
			return;
		}

		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.addEventListener(
			'load',
			() => {
				script.dataset.loaded = 'true';
				resolve();
			},
			{ once: true }
		);
		script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
			once: true
		});
		document.head.appendChild(script);
	});
}

async function loadFromUrls(urls: string[], check: () => boolean) {
	if (check()) {
		return;
	}

	let lastError: Error | undefined;

	for (const url of urls) {
		try {
			await appendScript(url);
			if (check()) {
				return;
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
		}
	}

	throw lastError ?? new Error('Required export dependency could not be loaded.');
}

export async function ensureExportDependencies() {
	await loadFromUrls(HTML_TO_IMAGE_URLS, () => Boolean(window.htmlToImage?.toCanvas));
	await loadFromUrls(JSZIP_URLS, () => Boolean(window.JSZip));
}

function buildRenderOptions(format: ExportFormat): RenderOptions {
	return {
		cacheBust: true,
		pixelRatio: 1,
		width: 1280,
		height: 720,
		canvasWidth: 1280,
		canvasHeight: 1280 / (16 / 9),
		backgroundColor: format === 'jpg' ? '#0b1a2e' : undefined,
		imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
		filter: (domNode) =>
			!(domNode instanceof HTMLElement && domNode.dataset.exportIgnore !== undefined)
	};
}

function humanizeRenderError(error: unknown) {
	if (typeof Event !== 'undefined' && error instanceof Event) {
		const target = 'target' in error ? error.target : null;
		const currentTarget = 'currentTarget' in error ? error.currentTarget : null;
		const source = target ?? currentTarget;

		if (source instanceof HTMLImageElement && source.src) {
			return `The browser could not render remote image assets. A failing image source appears to be: ${source.src}`;
		}

		if (source instanceof HTMLScriptElement && source.src) {
			return `A required render dependency failed to load: ${source.src}`;
		}

		return 'The browser blocked one of the assets needed to generate the preview image.';
	}

	const message = error instanceof Error ? error.message : String(error);
	const lower = message.toLowerCase();

	if (
		lower.includes('tainted') ||
		lower.includes('cors') ||
		lower.includes('fetch') ||
		lower.includes('security')
	) {
		return 'The browser could not render one or more remote images. Try a different image URL or a CORS-friendly/local asset.';
	}

	return message;
}

function isInvalidImageSource(image: HTMLImageElement) {
	const rawSrc = image.getAttribute('src')?.trim() ?? '';
	const resolvedSrc = image.src;
	const pageUrl = window.location.href;

	if (!rawSrc || rawSrc === '/') {
		return true;
	}

	if (resolvedSrc === pageUrl && rawSrc !== pageUrl) {
		return true;
	}

	return false;
}

function buildSanitizedRenderClone(node: ExportableNode) {
	const clone = node.cloneNode(true) as HTMLElement;
	clone.style.position = 'relative';
	clone.style.left = '0';
	clone.style.top = '0';
	clone.style.transform = 'none';
	clone.style.opacity = '1';

	for (const image of clone.querySelectorAll('img')) {
		const rawSrc = image.getAttribute('src')?.trim() ?? '';

		if (rawSrc) {
			image.setAttribute('src', rawSrc);
		}

		if (isInvalidImageSource(image)) {
			image.remove();
		}
	}

	return clone;
}

async function renderWithSanitizedClone<T>(node: ExportableNode, renderer: (clone: HTMLElement) => Promise<T>) {
	const clone = buildSanitizedRenderClone(node);
	const sandbox = document.createElement('div');
	sandbox.style.position = 'fixed';
	sandbox.style.inset = '0';
	sandbox.style.pointerEvents = 'none';
	sandbox.style.opacity = '0';
	sandbox.style.zIndex = '-1';
	sandbox.style.overflow = 'hidden';
	sandbox.appendChild(clone);
	document.body.appendChild(sandbox);

	try {
		return await renderer(clone);
	} finally {
		sandbox.remove();
	}
}

export function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();

	// Some browsers can leave generated downloads stuck in a temporary state
	// if the object URL is revoked immediately after the click.
	window.setTimeout(() => {
		link.remove();
		URL.revokeObjectURL(url);
	}, 60_000);
}

function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error('The browser could not generate an image blob.'));
					return;
				}

				resolve(blob);
			},
			format === 'jpg' ? 'image/jpeg' : 'image/png',
			0.94
		);
	});
}

export function buildThumbnailFilename(event: ThumbnailEvent, format: ExportFormat) {
	const title = slugify(event.title || 'video-thumbnail') || 'video-thumbnail';
	const extension = format === 'jpg' ? 'jpg' : 'png';

	if (event.day !== undefined && event.day !== null && `${event.day}`.trim() !== '') {
		return `day-${event.day}-${event.id}-${title}.${extension}`;
	}

	return `${event.id}-${title}.${extension}`;
}

export async function renderThumbnailBlob(node: ExportableNode, format: ExportFormat) {
	await ensureExportDependencies();

	const canvas = await renderWithSanitizedClone(node, (clone) =>
		window.htmlToImage!.toCanvas(clone, buildRenderOptions(format))
	);

	return canvasToBlob(canvas, format);
}

export async function renderThumbnailPreviewUrl(node: ExportableNode) {
	await ensureExportDependencies();

	try {
		const blob = await renderThumbnailBlob(node, 'png');
		return {
			url: URL.createObjectURL(blob),
			kind: 'raster'
		} satisfies PreviewRenderResult;
	} catch (blobError) {
		try {
			if (window.htmlToImage?.toSvg) {
				return {
					url: await renderWithSanitizedClone(node, (clone) =>
						window.htmlToImage!.toSvg!(clone, buildRenderOptions('png'))
					),
					kind: 'svg'
				} satisfies PreviewRenderResult;
			}
		} catch (svgError) {
			throw new Error(humanizeRenderError(svgError));
		}

		throw new Error(humanizeRenderError(blobError));
	}
}

export async function downloadSingleThumbnail(
	node: ExportableNode,
	event: ThumbnailEvent,
	format: ExportFormat
) {
	const blob = await renderThumbnailBlob(node, format);
	triggerDownload(blob, buildThumbnailFilename(event, format));
}

export async function downloadZipFromBlobs(entries: Array<{ filename: string; blob: Blob }>) {
	await ensureExportDependencies();

	const zip = new window.JSZip!();
	for (const entry of entries) {
		zip.file(entry.filename, entry.blob);
	}

	const archive = await zip.generateAsync({ type: 'blob' });
	const firstExtension = entries[0]?.filename.split('.').pop()?.toLowerCase();
	const archiveName =
		firstExtension === 'jpg'
			? 'ai-collective-thumbnails-jpg.zip'
			: firstExtension === 'png'
				? 'ai-collective-thumbnails-png.zip'
				: 'ai-collective-thumbnails.zip';
	triggerDownload(archive, archiveName);
}
