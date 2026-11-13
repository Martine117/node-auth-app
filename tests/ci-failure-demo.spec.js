import { test, expect } from '@playwright/test';

test('Intentional CI failure demonstration', () => {
  expect(true).toBe(false);
});
