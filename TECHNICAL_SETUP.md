# Technical Setup

This repository is a neutral SvelteKit starter built for a simple workshop workflow. Students can create a new repository from the template, open it in VS Code, and work inside a Dev Container on Windows, macOS, or Linux.

## Stack

- Node 22
- SvelteKit
- Svelte 5
- `@sveltejs/adapter-static`
- Tailwind CSS 4
- GSAP
- Vite
- npm
- VS Code Dev Containers
- Docker Desktop or Docker Engine for local development
- GitHub Pages deployment through GitHub Actions

## What This Template Is For

This template is designed for:

- static SvelteKit websites
- animation-heavy landing pages and microsites
- local development in VS Code Dev Containers
- publishing to GitHub Pages
- beginner-friendly workshop use

This template is not intended for:

- server-side hosting
- long-running backend services
- production Docker deployment

## Dev Container Design

The Dev Container is intended to give students a consistent development environment across operating systems.

The container should:

- build from the root `Dockerfile`
- use the `dev` target
- run as the `node` user
- install dependencies with `npm install`
- start the local dev server automatically
- forward the SvelteKit development port in VS Code

The Dev Container should not manually mount the host `.gitconfig` file.

VS Code Dev Containers already provide built-in support for reusing local Git configuration and credentials inside the container.

## GSAP Integration

GSAP is installed as a regular runtime dependency so local development, CI, and GitHub Pages builds all use the same package graph.

For Svelte components, this template exposes a small helper from `$lib`:

```ts
import { withGsapContext } from '$lib';
```

The helper:

- runs only in the browser
- respects `prefers-reduced-motion`
- scopes selectors to the current component root
- reverts the GSAP context automatically when the component unmounts

The starter page in `src/routes/+page.svelte` demonstrates the recommended pattern, and `.vscode/gsap.code-snippets` adds a `gsap-svelte` snippet for quick authoring in VS Code.

## Windows Host File Watching

When the Dev Container runs on a Windows host, the project files live on the Windows filesystem and are bind-mounted into the Linux container. In this configuration, the Linux kernel does not receive inotify events for changes made from the Windows side, so Vite's default file watcher misses them. The dev server keeps serving stale output until it is restarted.

Checking `process.platform` inside the container is not sufficient — it always reports `linux` regardless of the host OS.

To detect a Windows host, this template uses VS Code's local environment variable expansion to pass the host's `OS` environment variable into the container:

```json
"remoteEnv": { "HOST_OS": "${localEnv:OS}" }
```

On Windows, `OS` is set to `Windows_NT` by the operating system. On macOS and Linux hosts the variable is unset, so `HOST_OS` will be empty inside the container.

`vite.config.ts` reads this variable and enables polling only when needed:

```ts
const usePolling = process.env.HOST_OS === 'Windows_NT';
// ...
watch: usePolling ? { usePolling: true, interval: 100 } : undefined
```

This keeps the default, efficient inotify-based watching on macOS and Linux hosts while enabling polling only for Windows users who need it.

## Required Dev Container Configuration

Your `.devcontainer/devcontainer.json` should follow this pattern:

```json
{
  "name": "SvelteKit Template Dev Container",
  "build": {
    "dockerfile": "../Dockerfile",
    "target": "dev"
  },
  "remoteUser": "node",
  "remoteEnv": {
    "HOST_OS": "${localEnv:OS}"
  },
  "updateContentCommand": "npm install",
  "postStartCommand": "bash .devcontainer/scripts/start-dev-server.sh",
  "postAttachCommand": "bash .devcontainer/scripts/start-dev-server.sh",
  "waitFor": "postStartCommand",
  "forwardPorts": [5173],
  "portsAttributes": {
    "5173": {
      "label": "SvelteKit dev server",
      "onAutoForward": "openBrowser",
      "requireLocalPort": false
    },
    "5174-5190": {
      "label": "SvelteKit dev server",
      "onAutoForward": "openBrowser",
      "requireLocalPort": false
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "svelte.svelte-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-vscode-remote.remote-containers"
      ]
    }
  }
}
