import { test, expect } from '@playwright/test';

test('Nur Login überprüfen', async ({ page }) => {
  // 1. Seite laden
  await page.goto('http://localhost:4200/');

  // 2. Eingabefelder anhand des exakten Placeholders füllen (aus deinem HTML)
  await page.getByPlaceholder('Dein Name...').fill('test');
  await page.getByPlaceholder('Passwort...').fill('Qq123456');

  // 3. Den Button "Mein Board öffnen" klicken
  await page.getByRole('button', { name: 'Mein Board öffnen' }).click();

  // 4. BEWEIS: Schauen, ob der Erfolgs-Text im HTML auftaucht
  const successText = page.locator('.success-text');
  await expect(successText).toBeVisible({ timeout: 7000 }); // Wir geben dem Server 7 Sek. Zeit
  await expect(successText).toContainText('Bereit! Du bist als test unterwegs.');
});