import terser from '@rollup/plugin-terser';

const banner = ``;

export default [
    // ESM build
    {
        input: 'main.js',
        output: {
            file: 'dist/requestmanager.esm.js',
            format: 'esm',
            banner,
            sourcemap: true,
        },
    },
    // ESM minified build
    {
        input: 'main.js',
        output: {
            file: 'dist/requestmanager.esm.min.js',
            format: 'esm',
            banner,
            sourcemap: true,
        },
        plugins: [terser()],
    },
    // CommonJS build
    {
        input: 'main.js',
        output: {
            file: 'dist/requestmanager.cjs.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
    },
    // CommonJS minified build
    {
        input: 'main.js',
        output: {
            file: 'dist/requestmanager.cjs.min.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        plugins: [terser()],
    },
    // UMD build (for browsers)
    {
        input: 'index.js',
        output: {
            file: 'dist/requestmanager.umd.js',
            format: 'umd',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
    },
    // UMD minified build (for browsers)
    {
        input: 'index.js',
        output: {
            file: 'dist/requestmanager.umd.min.js',
            format: 'umd',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
        plugins: [terser()],
    },
    // CDN build (simple name for CDN usage)
    {
        input: 'index.js',
        output: {
            file: 'dist/requestmanager.js',
            format: 'iife',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
    },
    // CDN minified build (simple name for CDN usage)
    {
        input: 'index.js',
        output: {
            file: 'dist/requestmanager.min.js',
            format: 'iife',
            name: 'RequestManager',
            banner,
            sourcemap: true,
        },
        plugins: [terser()],
    },
];
