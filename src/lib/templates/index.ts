import AICollectivePanelDefault from './AICollectivePanelDefault.svelte';
import DataPhoenixNeonPanel from './DataPhoenixNeonPanel.svelte';
import type { ThumbnailTemplateDefinition } from '$lib/types';

export const thumbnailTemplates: ThumbnailTemplateDefinition[] = [
	{
		id: 'ai-collective-panel-default',
		name: 'AI Collective Panel Default',
		description: 'Editorial panel layout derived from the original enterprise test mockup.',
		component: AICollectivePanelDefault
	},
	{
		id: 'data-phoenix-neon-panel',
		name: 'Data Phoenix Neon Panel',
		description: 'Locked-background Data Phoenix session layout built around the original artwork.',
		component: DataPhoenixNeonPanel
	}
];

export function getTemplateById(templateId: string) {
	return thumbnailTemplates.find((template) => template.id === templateId) ?? thumbnailTemplates[0];
}
