#!/usr/bin/env bash

set -euo pipefail

resolve_image_name() {
	node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const workspaceDir = process.cwd();
const packageJsonPath = path.join(workspaceDir, 'package.json');

const sanitize = (value) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'sveltekit-dev';

let baseName = path.basename(workspaceDir);

if (fs.existsSync(packageJsonPath)) {
	try {
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		if (typeof packageJson.name === 'string' && packageJson.name.trim()) {
			baseName = packageJson.name;
		}
	} catch {}
}

console.log(`${sanitize(baseName)}-dev`);
NODE
}

image_name="$(resolve_image_name)"

echo "Building dev image: $image_name"
exec docker build --target dev -t "$image_name" .
