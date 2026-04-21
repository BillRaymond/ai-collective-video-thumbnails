#!/usr/bin/env bash

set -euo pipefail

workspace_dir="$(pwd)"
preferred_port=5173
max_port=5190

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

find_available_port() {
	node - "$preferred_port" "$max_port" <<'NODE'
const net = require('node:net');
const preferred = Number(process.argv[2]);
const max = Number(process.argv[3]);
const host = '127.0.0.1';

const canBind = (port, done) => {
	const server = net.createServer();
	server.unref();
	server.once('error', () => done(false));
	server.listen({ host, port }, () => {
		server.close(() => done(true));
	});
};

const tryPort = (port) => {
	if (port > max) {
		process.exit(1);
	}

	canBind(port, (available) => {
		if (available) {
			console.log(port);
			return;
		}

		tryPort(port + 1);
	});
};

tryPort(preferred);
NODE
}

if ! port="$(find_available_port)"; then
	echo "Unable to find an open host port between $preferred_port and $max_port." >&2
	exit 1
fi

image_name="$(resolve_image_name)"

echo "Starting dev container on http://localhost:$port"

exec docker run --rm -it \
	-p "$port:$port" \
	-v "$workspace_dir:/workspace" \
	-w /workspace \
	"$image_name" \
	bash -lc "npm install && npm run dev -- --host 0.0.0.0 --port $port"
