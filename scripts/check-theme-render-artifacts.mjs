import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const themesRoot = path.join(repoRoot, 'src', 'lib', 'themes');
const targetExtensions = new Set(['.css', '.svelte']);
const findings = [];

async function collectFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await collectFiles(fullPath)));
			continue;
		}

		if (targetExtensions.has(path.extname(entry.name))) {
			files.push(fullPath);
		}
	}

	return files;
}

function lineNumberForIndex(text, index) {
	return text.slice(0, index).split('\n').length;
}

function hasNonInsetBoxShadow(ruleBody) {
	const match = ruleBody.match(/box-shadow\s*:\s*([^;]+)/i);
	return Boolean(match && match[1].trim().toLowerCase() !== 'none');
}

function checkCssRules(filePath, content) {
	const cssRulePattern = /([^{}]+)\{([^{}]*)\}/g;
	let match;

	while ((match = cssRulePattern.exec(content)) !== null) {
		const selector = match[1].trim();
		const ruleBody = match[2];

		if (!selector.includes('speaker-card')) {
			continue;
		}

		const line = lineNumberForIndex(content, match.index);
		const relativePath = path.relative(repoRoot, filePath);

		if (/backdrop-filter\s*:/i.test(ruleBody)) {
			findings.push(
				`${relativePath}:${line} speaker-card rules must not use backdrop-filter; html-to-image renders it as rectangular bands.`
			);
		}

		if (hasNonInsetBoxShadow(ruleBody)) {
			findings.push(
				`${relativePath}:${line} speaker-card rules must not use box-shadow; use solid pills and borders so html-to-image does not create rectangular bands.`
			);
		}
	}
}

const files = await collectFiles(themesRoot);

for (const filePath of files) {
	const content = await readFile(filePath, 'utf8');
	checkCssRules(filePath, content);
}

if (findings.length > 0) {
	console.error('Theme render artifact check failed:');
	for (const finding of findings) {
		console.error(`- ${finding}`);
	}
	process.exit(1);
}

console.log('Theme render artifact check passed.');
