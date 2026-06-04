import { z } from 'zod';

// Safety boundary: students never write code, but they do supply URLs (links,
// images). Only allow schemes that can't execute script. Relative URLs resolve
// against a dummy base, so they validate as http(s). `javascript:` / `data:` are
// rejected. This guards the published page against injected script (minors + public).
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function isSafeUrl(value: string): boolean {
	try {
		const url = new URL(value, 'https://zine.local');
		return SAFE_PROTOCOLS.has(url.protocol);
	} catch {
		return false;
	}
}

export const SafeUrlSchema = z
	.string()
	.trim()
	.min(1)
	.refine(isSafeUrl, { message: 'Link must be an http(s), mailto, or relative URL.' });
