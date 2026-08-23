import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

const banner = ``;

// Transpiles modern syntax (private class members, optional chaining, etc.) so the
// bundles run on older browsers.
const transpile = [
    babel({
        babelHelpers: 'bundled',
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: '> 0.5%, last 2 versions, Firefox ESR, not dead, Safari >= 10',
                },
            ],
        ],
    }),
];

export default [
    // ESM build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.esm.js',
            format: 'esm',
            banner,
            sourcemap: true,
        },
        plugins: [...transpile],
    },
    // ESM minified build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.esm.min.js',
            format: 'esm',
            banner,
            sourcemap: true,
        },
        plugins: [...transpile, terser()],
    },
    // CommonJS build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.cjs.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        plugins: [...transpile],
    },
    // CommonJS minified build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.cjs.min.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        plugins: [...transpile, terser()],
    },
    // UMD build (for browsers)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.umd.js',
            format: 'umd',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
        plugins: [...transpile],
    },
    // UMD minified build (for browsers)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.umd.min.js',
            format: 'umd',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
        plugins: [...transpile, terser()],
    },
    // CDN build (simple name for CDN usage)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.js',
            format: 'iife',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
        plugins: [...transpile],
    },
    // CDN minified build (simple name for CDN usage)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.min.js',
            format: 'iife',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
        plugins: [...transpile, terser()],
    },
];
