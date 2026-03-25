module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^dayjs$': '<rootDir>/test/__mocks__/dayjs.ts',
    '^dayjs/plugin/utc$': '<rootDir>/test/__mocks__/dayjs/plugin/utc.ts',
    '^dayjs/plugin/timezone$': '<rootDir>/test/__mocks__/dayjs/plugin/timezone.ts',
  },
  moduleDirectories: ['node_modules', '<rootDir>/test/__mocks__'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
};