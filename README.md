# SvelteKit + Tailwind GitHub Pages Template

This repository is a GitHub template for building and publishing a static site with SvelteKit, Tailwind CSS, GSAP, VS Code Dev Containers, and GitHub Pages.

It is designed to be forked, renamed, and repurposed without carrying forward workshop branding or repo-specific deployment assumptions.

Created by Bill Raymond, owner of [Cambermast LLC](https://cambermast.com), with the tagline `AI Agility in Action`.

## Table of Contents

- [SvelteKit + Tailwind GitHub Pages Template](#sveltekit--tailwind-github-pages-template)
  - [Table of Contents](#table-of-contents)
  - [What This Template Includes](#what-this-template-includes)
  - [One-Time Setup](#one-time-setup)
    - [1. Create your repository from the template](#1-create-your-repository-from-the-template)
    - [2. Enable GitHub Pages](#2-enable-github-pages)
    - [3. Open your repository in VS Code](#3-open-your-repository-in-vs-code)
    - [4. Start the Dev Container](#4-start-the-dev-container)
    - [5. Preview your site locally](#5-preview-your-site-locally)
    - [6. Make your first change](#6-make-your-first-change)
  - [Every time you want to make a change](#every-time-you-want-to-make-a-change)
  - [Deployment Model](#deployment-model)
  - [After Using This Template](#after-using-this-template)
  - [Local Commands](#local-commands)
  - [Troubleshooting](#troubleshooting)
  - [Technical Notes](#technical-notes)

## What This Template Includes

- SvelteKit with the static adapter configured for GitHub Pages
- Svelte 5, Tailwind CSS 4, GSAP, Vite, and Node 22
- A VS Code Dev Container workflow for consistent local development
- A dedicated CI workflow for build and type-check validation on branches and pull requests
- GitHub Actions deployment to GitHub Pages
- Dynamic dev-port fallback behavior that works well in VS Code and containers
- A shared `$lib` GSAP helper plus a VS Code snippet for Svelte animations

## One-Time Setup

### 1. Create your repository from the template

1. Select **Use this template** at the top of this GitHub repository page.
2. Choose **Create a new repository**.
3. Name your repository. Keep it simple, lowercase, and use dashes in between each word. For example:
   `my-company-website` or `my-portfolio`.
4. Set visibility to **Public** (required for GitHub Pages on free accounts).
5. Select **Create repository from template**.

### 2. Enable GitHub Pages

1. In your new repository on GitHub, select **Settings**.
2. In the left sidebar, select **Pages**.
3. Under **Source**, select **GitHub Actions**.

### 3. Open your repository in VS Code

You will clone your new repository directly to your computer using VS Code. Cloning downloads a full copy of the repository so you can work on it locally.

> **Tip:** Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) in VS Code before following these steps if you have not already.

1. Open VS Code.
2. Open the Command Palette (`Ctrl+Shift+P` on Windows or `Cmd+Shift+P` on Mac).
3. Type **Git: Clone** and press Return.
4. Select **Clone from GitHub** and press Return.
5. Select the new repository you created from this template.
6. Choose a folder on your computer to save the repository into.
7. When VS Code asks if you want to open the cloned repository, select **Open**.

### 4. Start the Dev Container

1. Open the Command Palette (`Ctrl+Shift+P` on Windows or `Cmd+Shift+P` on Mac).
2. Type **Dev Containers: Open Folder in Container** and press Return.
3. Browse to the folder where you cloned the repository and confirm.
4. Wait for the container to build and the dev server to start. This may take a few minutes the first time.

### 5. Preview your site locally

1. Open the Command Palette (`Ctrl+Shift+P` on Windows or `Cmd+Shift+P` on Mac) and type **View: Toggle Ports**, then press Return.
2. In the **Ports** tab that appears, find the forwarded port entry and select the globe icon to open the running site in your browser.

### 6. Make your first change

Before publishing, try making a small change to confirm everything is working end to end.

1. Open the Claude or ChatGPT extension in VS Code and start a new chat.
2. Ask the AI to make a small visible change. For example: `Add the following text to the home page: "testing to see if github pages works"`.
3. Open the Command Palette (`Ctrl+Shift+P` on Windows or `Cmd+Shift+P` on Mac) and type **View: Toggle Ports**, then select the globe icon to preview the change in your browser.
4. Prompt the AI to commit the change and sync it to GitHub. For example: `Commit the change you just made and sync to GitHub. Check status and wait until it is complete and then provide the url so I can view the page online`.
5. Save the URL for your live site so you can verify changes moving forward.

## Every time you want to make a change

1. Think about the one thing you want to change in the website.
2. Open a new chat in your AI tool and describe that single change.
3. Apply the suggestion in VS Code and preview it locally using the globe icon in the **Ports** tab.
4. When you are happy with the changes, prompt your AI tool (Claude or ChatGPT) to commit the changes and sync them to GitHub for you. For example: `Commit the changes you just made and sync to GitHub`.
5. Wait for the GitHub Actions workflows to complete, then verify the change on your live site.

## Deployment Model

This template is intended for static-site deployment on GitHub Pages.

- `@sveltejs/adapter-static` is the production adapter
- `.github/workflows/deploy-pages.yml` builds and deploys the site to GitHub Pages
- The workflow automatically sets `BASE_PATH` so both project pages and user/organization pages work correctly

## After Using This Template

- Remove or replace the attribution line near the top of this README.
- Replace the starter page, metadata, social metadata, images, and favicon with your own before launch.
- Update the package metadata only if you want a different package name than the neutral default.
- Keep the included MIT license if it fits your project, or replace it with a different license if your needs differ.

## Local Commands

```sh
npm install
npm run dev
npm run build
npm run check
```

## GSAP

GSAP is included as a first-class dependency in this template.

- Import `withGsapContext` from `$lib` for Svelte-friendly setup and cleanup.
- The starter home page already uses this pattern as a working example.
- In VS Code, use the `gsap-svelte` snippet inside a `.svelte` file to scaffold a new animation block quickly.

If you want to build and run the dev image directly outside VS Code:

```sh
npm run docker:dev:build
npm run docker:dev:run
```

## Troubleshooting

- Make sure Docker Desktop is running before reopening in the container.
- The first container build can take a few minutes.
- If you do not see the running site, check the VS Code Ports view.
- If the container gets into a bad state, try `Dev Containers: Rebuild Container`.
- Manual deploys are available through the `Deploy to GitHub Pages` workflow if you want to publish before your first push to the default branch.
- **On Windows, source changes may not appear in the browser automatically.** When a Dev Container runs on a Windows host, the Linux container does not receive file-change notifications from the Windows filesystem, so Vite's watcher can miss edits. This template detects a Windows host via `HOST_OS` (set in `devcontainer.json`) and enables Vite polling automatically. If hot-reload stops working, rebuild the container to pick up the latest configuration.

## Technical Notes

More setup details are in [TECHNICAL_SETUP.md](./TECHNICAL_SETUP.md).
