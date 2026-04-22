import type { Component } from 'svelte';

export type ImageStatus = 'idle' | 'loading' | 'valid' | 'failed';
export type ExportFormat = 'png' | 'jpg';
export type ThumbnailThemeTextField =
	| 'backgroundImageUrl'
	| 'eventLogoUrl'
	| 'producerCredit'
	| 'ctaText';
export type ThumbnailThemePersonField =
	| 'role'
	| 'name'
	| 'company'
	| 'photoUrl'
	| 'companyLogoUrl'
	| 'photoPosition'
	| 'logoScale';

export interface EventPersonSource {
	name: string;
	company: string;
	photo_url: string;
	company_logo_url: string;
}

export interface EventSource {
	id: number | string;
	day?: number | string | null;
	title: string;
	moderators: EventPersonSource[];
	confirmed_speakers: EventPersonSource[];
}

export interface ThumbnailPerson {
	id: string;
	role: string;
	name: string;
	company: string;
	photoUrl: string;
	companyLogoUrl: string;
	photoPositionX: number;
	photoPositionY: number;
	logoScale: number;
}

export interface ThumbnailConfig {
	eventLogoUrl: string;
	backgroundImageUrl: string;
	producerCredit: string;
	ctaText: string;
	people: ThumbnailPerson[];
}

export interface ThumbnailEvent extends EventSource {
	thumbnail: ThumbnailConfig;
}

export interface ThumbnailProject {
	version: '1.0';
	generatedBy: 'ai-collective-thumbnail-studio';
	exportedAt: string;
	events: ThumbnailEvent[];
}

export interface ThumbnailThemeProps {
	event: ThumbnailEvent;
}

export interface ThumbnailThemeMeta {
	id: string;
	name: string;
	description: string;
	order?: number;
}

export interface ThumbnailThemeEditorCapabilities {
	brandingFields: ThumbnailThemeTextField[];
	personFields: ThumbnailThemePersonField[];
}

export interface ThumbnailThemeAssets {
	[key: string]: string;
}

export interface ThumbnailThemeDefinition {
	meta: ThumbnailThemeMeta;
	component: Component<ThumbnailThemeProps>;
	defaults: (event: EventSource) => Partial<ThumbnailConfig>;
	editor: ThumbnailThemeEditorCapabilities;
	assets?: ThumbnailThemeAssets;
	legacyAssetUrls?: Record<string, string>;
}
