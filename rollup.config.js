import terser from '@rollup/plugin-terser';

const banner = ``;

export default [
    // ESM build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.esm.js',
            format: 'esm',
            banner,
            sourcemap: true
        }
    },
    // ESM minified build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.esm.min.js',
            format: 'esm',
            banner,
            sourcemap: true
        },
        plugins: [terser()]
    },
    // CommonJS build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.cjs.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named'
        }
    },
    // CommonJS minified build
    {
        input: 'main.js',
        output: {
            file: 'dist/request-manager.cjs.min.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named'
        },
        plugins: [terser()]
    },
    // UMD build (for browsers)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.umd.js',
            format: 'umd',
            name: 'RequestManager',
            banner,
            sourcemap: true
        }
    },
    // UMD minified build (for browsers)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.umd.min.js',
            format: 'umd',
            name: 'RequestManager',
            banner,
            sourcemap: true
        },
        plugins: [terser()]
    },
    // CDN build (simple name for CDN usage)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.js',
            format: 'iife',
            name: 'RequestManager',
            banner,
            sourcemap: true
        }
    },
    // CDN minified build (simple name for CDN usage)
    {
        input: 'index.js',
        output: {
            file: 'dist/request-manager.min.js',
            format: 'iife',
            name: 'RequestManager',
            banner,
            sourcemap: true
        },
        plugins: [terser()]
    }
];
