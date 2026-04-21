# AI Collective Thumbnail Studio

Static SvelteKit app for turning event JSON into editable 1280×720 video thumbnails. The studio starts from the AI Collective default panel template, lets you review and adjust people/logo/image metadata, and exports PNG or JPG files directly in the browser.

## What It Does

- Upload a raw event JSON file or load the included sample data
- Normalize source event data into a thumbnail-friendly editing model
- Edit title, eyebrow, background, event logo, CTA, producer credit, and people metadata
- Preview the active thumbnail live before export
- Save a new augmented JSON file with thumbnail settings preserved
- Export one PNG/JPG at a time or package all PNG renders into a ZIP

## Local Commands

```sh
npm run dev
npm run check
npm run build
```

## Accepted Input Shape

The app accepts either:

1. A raw event array
2. A previously exported thumbnail project object

### Raw event array

```json
[
  {
    "id": 1,
    "day": 1,
    "title": "Building the AI-Powered Enterprise",
    "moderators": [
      {
        "name": "Catherine McMillan",
        "company": "The AI Collective",
        "photo_url": "",
        "company_logo_url": "https://example.com/logo.png"
      }
    ],
    "confirmed_speakers": []
  }
]
```

### Required vs optional fields

- `id`: required for stable editing and filenames
- `title`: required for preview/export naming
- `day`: optional; omitted from filenames when absent
- `moderators`: optional array
- `confirmed_speakers`: optional array
- `photo_url` and `company_logo_url`: optional, but missing values fall back safely in the preview

## Augmented Output Shape

When you save the edited project JSON, the app preserves source event fields and adds a `thumbnail` block per event.

```json
{
  "version": "1.0",
  "generatedBy": "ai-collective-thumbnail-studio",
  "exportedAt": "2026-04-21T00:00:00.000Z",
  "events": [
    {
      "id": 1,
      "day": 1,
      "title": "Building the AI-Powered Enterprise",
      "moderators": [],
      "confirmed_speakers": [],
      "thumbnail": {
        "templateId": "ai-collective-panel-default",
        "variantLabel": "Panel Discussion",
        "eyebrow": "Day 1 · The AI Collective",
        "eventLogoUrl": "/HumanX-white-logo-cropped.png",
        "backgroundImageUrl": "/default-thumbnail-bg.png",
        "producerCredit": "KROK PRODUCTIONS by Data Phoenix",
        "ctaText": "Watch Now",
        "people": [
          {
            "id": "1-moderator-1",
            "role": "Moderator",
            "name": "Catherine McMillan",
            "company": "The AI Collective",
            "photoUrl": "",
            "companyLogoUrl": "https://example.com/logo.png",
            "photoPositionX": 50,
            "photoPositionY": 50,
            "logoScale": 100
          }
        ]
      }
    }
  ]
}
```

## Import Notes For The Included Sample JSON

The root sample file, [ai_collective_events_enriched_with_ids_reordered.json](./ai_collective_events_enriched_with_ids_reordered.json), works as the baseline import source.

The app derives `thumbnail.people[]` automatically from:

- `moderators` → `role: "Moderator"`
- `confirmed_speakers` → `role: "Panelist"`

You will usually want to augment source events with thumbnail-specific values because the raw source data does not currently include:

- `backgroundImageUrl`
- `eventLogoUrl`
- `variantLabel`
- `eyebrow`
- `producerCredit`
- `ctaText`
- crop/position overrides for photos and logos

## Filename Rules

Exports are slugified from the event title.

- With day: `day-{day}-{id}-{event-name}.{ext}`
- Without day: `{id}-{event-name}.{ext}`

Examples:

- `day-1-1-building-the-ai-powered-enterprise.png`
- `9-code-gen-claude-code-codex-cursor-for-the-devs.jpg`

## Browser Export Limitations

The app is intentionally browser-only so it stays GitHub Pages friendly. That means remote images must be readable by the browser during export.

- A logo/photo/background URL may preview correctly but still fail during export if the host blocks cross-origin canvas rendering.
- If that happens, replace the URL with a CORS-friendly source or host the image locally.
- The preview status indicator only checks whether the image can load in the browser, not whether the remote host allows canvas export.

## Template System

V1 ships one template:

- `ai-collective-panel-default`

Templates are registry-based so more layouts can be added later. Each template definition needs:

- `id`
- `name`
- `description`
- Svelte preview component

The event JSON stores `thumbnail.templateId`, so a single project can support multiple templates over time without changing the top-level project shape.

## Design-System Assets Brought In From The ZIP

Only the curated subset needed for the studio was copied into `static/`:

- `Wordmark-White.png`
- `AIC-Logo-White-cropped.png`
- `HumanX-white-logo-cropped.png`
- `default-thumbnail-bg.png`
- `Georgia-Bold.ttf`

The rest of the ZIP remains external to the repo.
