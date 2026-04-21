FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS base

WORKDIR /workspace

ENV npm_config_update_notifier=false

FROM base AS dev

USER node
