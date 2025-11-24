export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'index.js',
        '!**/node_modules/**',
        '!**/__tests__/**',
    ],
};
