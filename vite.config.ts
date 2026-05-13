import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(
    readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
);

export default defineConfig({
    define: {
        __XCS_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            fileName: 'index',
            formats: ['es'],
        },
        rollupOptions: {
            external: [
                /^node:.*/,
                'fs',
                'path',
                'os',
                'crypto',
                'assert',
                'util',
                'yargs',
                'yargs/helpers',
                'cosmiconfig',
                'json5',
                '@inquirer/prompts',
                '@bacons/xcode',
                'chalk',
                'i18n-strings-files',
                'fast-glob',
                'pino',
                '@cfworker/json-schema',
                /^@modelcontextprotocol\/sdk\/.*/,
                '@modelcontextprotocol/sdk',
                'zod',
            ],
        },
        target: 'node18',
        emptyOutDir: true,
    },
});
