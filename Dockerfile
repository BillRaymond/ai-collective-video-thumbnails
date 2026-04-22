FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS base

WORKDIR /workspace

ENV npm_config_update_notifier=false
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

ARG PLAYWRIGHT_VERSION=1.59.1

# Chromium-based Playwright runs need these shared libraries available in the
# container image. We also preinstall a pinned Chromium browser so a rebuilt
# container is immediately ready for Playwright smoke tests without a separate
# `npx playwright install` step. Keep PLAYWRIGHT_VERSION in sync with the
# version declared in package.json.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		libasound2 \
		libatk-bridge2.0-0 \
		libatk1.0-0 \
		libatspi2.0-0 \
		libdbus-1-3 \
		libgbm1 \
		libnspr4 \
		libnss3 \
		libxcomposite1 \
		libxdamage1 \
		libxfixes3 \
		libxkbcommon0 \
		libxrandr2 \
		xdg-utils \
	&& rm -rf /var/lib/apt/lists/* \
	&& mkdir -p "${PLAYWRIGHT_BROWSERS_PATH}" \
	&& npx -y playwright@${PLAYWRIGHT_VERSION} install chromium \
	&& chown -R node:node "${PLAYWRIGHT_BROWSERS_PATH}"

FROM base AS dev

USER node
