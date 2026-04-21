import AICollectivePanelDefault from './AICollectivePanelDefault.svelte';
import type { ThumbnailTemplateDefinition } from '$lib/types';

export const thumbnailTemplates: ThumbnailTemplateDefinition[] = [
	{
		id: 'ai-collective-panel-default',
		name: 'AI Collective Panel Default',
		description: 'Editorial panel layout derived from the original enterprise test mockup.',
		component: AICollectivePanelDefault
	}
];

export function getTemplateById(templateId: string) {
	return thumbnailTemplates.find((template) => template.id === templateId) ?? thumbnailTemplates[0];
}
