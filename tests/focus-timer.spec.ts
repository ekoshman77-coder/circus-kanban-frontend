import { test, expect } from '@playwright/test';
import { loginAndGetStatus } from './helpers/login-helper';
import { createTestTodo, deleteTestTodo } from './helpers/todo-helper';

async function navigateToFocusAndSelectTodo(page: any, taskName: string) {
  // Seite neu laden, damit das Todo im Signal landet
  await page.reload();

  // Zum Fokus-Timer wechseln
  await page.getByRole('button', { name: '⏳ Fokus-Timer' }).click();
  await expect(page).toHaveURL(/\/focus/);

  // Dropdown aktivieren und Todo auswählen
  await page.locator('#todo-select').click();
  await page.locator('#todo-select').selectOption({ label: taskName });
}

test('Sollte den Fokus-Timer starten und erfolgreich pausieren', async ({ page, context }) => {
  const csrfToken = await loginAndGetStatus(page, context);
  const taskName = 'Timer-Pause-Test';
  const todoId = await createTestTodo(page, csrfToken, taskName);
  
  try {
    // Hier nutzen wir den exakten Ablauf aus Test 1!
    await navigateToFocusAndSelectTodo(page, taskName);

    // 1. Timer starten
    const startButton = page.getByRole('button', { name: '▶️ Fokus Starten' });
    await expect(startButton).toBeEnabled(); // Sicherstellen, dass er aktiv ist
    await startButton.click();

    // 2. Prüfen, ob der Button-Text zu "Pause" wechselt
    const pauseButton = page.getByRole('button', { name: '⏸️ Pause' });
    await expect(pauseButton).toBeVisible();

    // 3. Timer pausieren
    await pauseButton.click();

    // 4. Prüfen, ob der Button wieder zu "Fokus Starten" wird
    await expect(startButton).toBeVisible();

  } finally {
    await deleteTestTodo(page, csrfToken, todoId);
  }
});

test('Sollte den Fokus-Timer zurücksetzen (abbrechen)', async ({ page, context }) => {
  const csrfToken = await loginAndGetStatus(page, context);
  const taskName = 'Timer-Reset-Test';
  const todoId = await createTestTodo(page, csrfToken, taskName);
  
  try {
    // Auch hier: Sicherer Weg in die Fokus-Zone
    await navigateToFocusAndSelectTodo(page, taskName);

    // 1. Timer starten
    await page.getByRole('button', { name: '▶️ Fokus Starten' }).click();

    // Während der Timer läuft, MUSS der Zurücksetzen-Button deaktiviert sein
    const resetButton = page.getByRole('button', { name: '🔄 Zurücksetzen' });
    await expect(resetButton).toBeDisabled();

    // 2. Timer pausieren, damit Zurücksetzen aktiv wird
    await page.getByRole('button', { name: '⏸️ Pause' }).click();
    await expect(resetButton).toBeEnabled();

    // 3. Zurücksetzen klicken
    await resetButton.click();

    // 4. Prüfen, ob der Status-Text wieder auf "Bereit zum Start" springt
    await expect(page.getByText('⏸️ Bereit zum Start')).toBeVisible();

  } finally {
    await deleteTestTodo(page, csrfToken, todoId);
  }
});

test('To-Do über API erstellen und im Fokus-Timer aufrufen', async ({ page, context }) => {

 const csrfToken = await loginAndGetStatus(page, context);
  const taskName = 'Timer-API-Selection-Test';
  const todoId = await createTestTodo(page, csrfToken, taskName);

    await navigateToFocusAndSelectTodo(page, taskName);
    await expect(page.getByRole('button', { name: '▶️ Fokus Starten' })).toBeEnabled();
});