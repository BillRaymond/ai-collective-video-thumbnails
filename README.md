# AI Collective Thumbnail Studio

Static SvelteKit app for turning event JSON into editable 1280×720 video thumbnails. The studio supports packaged thumbnail themes, lets you review and adjust people/logo/image metadata, and exports PNG or JPG files directly in the browser.

## What It Does

- Upload a raw event JSON file or load the included sample data
- Normalize source event data into a thumbnail-friendly editing model
- Edit title, background, event logo, CTA, producer credit, and people metadata
- Preview the active thumbnail live before export
- Save a new augmented JSON file with thumbnail settings preserved
- Export one PNG/JPG at a time or package all PNG renders into a ZIP

## Local Commands

```sh
npm run dev
npm run check
npm run build
npm run theme:new -- my-new-theme
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

The saved JSON is intended to stay theme-agnostic. It stores shared thumbnail data and feature values that any theme may choose to use, ignore, or reinterpret at render time.

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

The root sample file, [default-list.json](./default-list.json), works as the baseline import source.

The app derives `thumbnail.people[]` automatically from:

- `moderators` → `role: "Moderator"`
- `confirmed_speakers` → `role: "Panelist"`

You will usually want to augment source events with thumbnail-specific values because the raw source data does not currently include:

- `backgroundImageUrl`
- `eventLogoUrl`
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

## Theme System

Themes now live under `src/lib/themes/<theme-id>/` and are auto-discovered with `import.meta.glob`.

The app currently ships:

- `ai-collective-panel-default`
- `data-phoenix-neon-panel`

Each theme package owns:

- `index.ts` with `meta`, `component`, `defaults`, `editor`, and optional `assets`
- `Theme.svelte` for the renderable thumbnail
- `theme.css` for theme-local styles when needed
- `assets/` for theme-specific fonts and imagery
- `defaults.ts` for theme-aware fallback values

### Theme behavior and JSON expectations

- The project JSON is theme-agnostic and should be treated as shared content/configuration, not as a theme-specific document format.
- A theme decides which fields from `thumbnail` it uses, ignores, or renders differently.
- The editor theme should remain stable while you move between slides; slide navigation should not unexpectedly swap themes.
- The active theme is chosen in the studio UI rather than persisted in the JSON payload.

### Theme package rules

- Keep app/editor shell styles in `src/routes/layout.css`
- Keep thumbnail render styles inside the theme package
- Put theme-only assets in the theme's `assets/` folder and import them through Vite
- Use the `editor` capability metadata to declare which event, branding, and people controls the theme actually uses

### Scaffolding a new theme

Run:

```sh
npm run theme:new -- my-new-theme
```

This creates:

- `src/lib/themes/my-new-theme/index.ts`
- `src/lib/themes/my-new-theme/defaults.ts`
- `src/lib/themes/my-new-theme/Theme.svelte`
- `src/lib/themes/my-new-theme/theme.css`
- `src/lib/themes/my-new-theme/assets/.gitkeep`

Theme IDs should be kebab-case. New theme folders are picked up automatically without editing a central registry file.

## Design-System Assets Brought In From The ZIP

Theme-owned fonts and imagery now live alongside each theme package in `src/lib/themes/*/assets/`.

Legacy asset paths in older saved JSON are still mapped at import time so previously exported projects continue to load correctly.
