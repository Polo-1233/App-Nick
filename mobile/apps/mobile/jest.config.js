/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@r90/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@r90/core$': '<rootDir>/../../packages/core/src/index.ts',
  },
};
