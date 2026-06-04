import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { relative, sep } from 'node:path';

const SERVER_PREFIX = ['src', 'lib', 'server'].join('/') + '/';
const FORBIDDEN_SERVICE_ROLE = [/SERVICE_ROLE/i, /service[_-]?role[_-]?key/i];

const zineRules = {
	rules: {
		'no-service-role-outside-server': {
			meta: {
				type: 'problem',
				docs: {
					description: 'Forbid Supabase service-role key references outside src/lib/server/**.'
				},
				messages: {
					leak: 'Service-role key references are allowed only under src/lib/server/**.'
				}
			},
			create(context) {
				const filename = context.filename ?? context.getFilename();
				const rel = relative(process.cwd(), filename).split(sep).join('/');

				if (rel.startsWith(SERVER_PREFIX) || /\.(test|spec)\./.test(rel)) {
					return {};
				}

				return {
					Program(node) {
						const source = context.sourceCode.text;
						if (FORBIDDEN_SERVICE_ROLE.some((re) => re.test(source))) {
							context.report({ node, messageId: 'leak' });
						}
					}
				};
			}
		}
	}
};

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['src/**/*.{js,ts,svelte}'],
		plugins: {
			zine: zineRules
		},
		rules: {
			'zine/no-service-role-outside-server': 'error',
			// Allow intentionally-unused identifiers prefixed with `_` (e.g. a block
			// Render that keeps the uniform `props` signature but ignores it).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'playwright-report/',
			'test-results/',
			'storybook-static/'
		]
	}
);
