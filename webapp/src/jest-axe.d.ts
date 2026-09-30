import type { AxeResults } from 'jest-axe';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T extends AxeResults ? void : never;
  }
}
