// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		htmlToImage?: {
			toSvg?: (
				node: HTMLElement,
				options?: {
					cacheBust?: boolean;
					pixelRatio?: number;
				width?: number;
				height?: number;
				canvasWidth?: number;
				canvasHeight?: number;
				backgroundColor?: string;
				imagePlaceholder?: string;
				filter?: (node: Node) => boolean;
			}
		) => Promise<string>;
			toCanvas: (
				node: HTMLElement,
				options?: {
					cacheBust?: boolean;
					pixelRatio?: number;
					width?: number;
					height?: number;
					canvasWidth?: number;
					canvasHeight?: number;
					backgroundColor?: string;
					imagePlaceholder?: string;
					filter?: (node: Node) => boolean;
				}
			) => Promise<HTMLCanvasElement>;
		};
		JSZip?: new () => {
			file: (filename: string, data: Blob) => void;
			generateAsync: (options: { type: 'blob' }) => Promise<Blob>;
		};
	}
}

export {};
