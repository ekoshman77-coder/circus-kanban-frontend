import { test, expect } from '@playwright/test';

test('Sollte das Namensfeld auf der Startseite anzeigen', async ({ page }) => {
  await page.goto('/');

  // Sucht nach dem Input mit dem Platzhalter-Text
  const nameInput = page.locator('input[placeholder="Dein Name..."]');
  
  // Prüft, ob es für den User sichtbar auf dem Bildschirm ist
  await expect(nameInput).toBeVisible();
});