import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
            ],
        },
        target: 'node18',
        emptyOutDir: true,
    },
});
