import { Page, BrowserContext, expect } from '@playwright/test';

export async function loginAndGetStatus(page: Page, context: BrowserContext): Promise<string> {
  // 1. Der Login-Prozess, den wir gebaut haben
  await page.goto('http://localhost:4200/');
  await page.getByPlaceholder('Dein Name...').fill('test');
  await page.getByPlaceholder('Passwort...').fill('Qq123456');
  await page.getByRole('button', { name: 'Mein Board öffnen' }).click();
  
  // Warten, bis wir wirklich drin sind
  await expect(page.locator('.success-text')).toBeVisible();

  // 2. CSRF-Token aus den Cookies fischen
  const cookies = await context.cookies();
  const xsrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');
  return xsrfCookie ? xsrfCookie.value : '';
}