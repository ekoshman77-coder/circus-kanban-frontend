import { test, expect } from '@playwright/test';
import { loginAndGetStatus } from './login-helper';
import { deleteTestTodo, createTestTodo } from './todo-helper'

// Hilfsfunktion für die Navigation zu den To-Dos über die Welcome-Seite
async function navigateToTodoList(page: any) {
  const goToBoardButton = page.getByRole('button', { name: 'Gehe zu meinen To-Dos →' });
  await goToBoardButton.waitFor({ state: 'visible' });
  await goToBoardButton.click();
}

test.describe('To-Do Liste - Formular & Validierung', () => {

  test('Sollte Aufgabe erst freigeben, wenn Name und Zukunftsdatum befüllt sind', async ({ page, context }) => {
    const csrfToken = await loginAndGetStatus(page, context);
    await navigateToTodoList(page);

    // Locators für die Formularfelder und den Button ermitteln
    const taskInput = page.locator('#task');
    const dateInput = page.locator('#dueDate');
    const submitButton = page.getByRole('button', { name: '➕ Aufgabe erstellen' });

    // REGEL-CHECK 1: Formular ist frisch geladen -> Button MUSS disabled sein
    await expect(submitButton).toBeDisabled();

    // 1. SCHRITT: Nur den Namen ausfüllen (Valide ab 3 Zeichen)
    await taskInput.fill('UI-Test Aufgabe');
    await expect(submitButton).toBeDisabled(); // Immer noch gesperrt, weil Datum fehlt

    // 2. SCHRITT: Ein fehlerhaftes Datum in der Vergangenheit wählen (z.B. Jahr 2020)
    await dateInput.fill('2020-01-01');
    await dateInput.dispatchEvent('change'); // Event feuern für die Angular-Logik

    // REGEL-CHECK 2: Fehlermeldung muss sichtbar sein, Button bleibt gesperrt
    const pastError = page.getByText('⚠️ Das Datum darf nicht in der Vergangenheit liegen!');
    await expect(pastError).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // 3. SCHRITT: Ein gültiges Datum in der Zukunft wählen (z.B. Jahr 2030)
    // Wir nehmen ein fixes Zukunftsdatum, damit es unabhängig vom aktuellen Jahr immer klappt
    await dateInput.fill('2030-12-31');
    await dateInput.dispatchEvent('change');

    // REGEL-CHECK 3: Fehler verschwindet, Button wird endlich aktiv!
    await expect(pastError).not.toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Interne ID abfangen, falls das Todo erstellt wird, um es im finally-Block zu löschen
    // Da das Frontend über den TodoService die Daten sendet, lauschen wir kurz auf das HTTP-Antwort-Paket
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/todos') && response.request().method() === 'POST'
    );

    // Aufgabe absenden!
    await submitButton.click();

    // ID für das automatische Aufräumen sichern
    const response = await responsePromise;
    const responseData = await response.json();
    const createdTodoId = responseData.id;
    await page.reload();
    // Cleanup: DB sauber hinterlassen
    try {
      await deleteTestTodo(page, csrfToken, createdTodoId);
    } catch (e) {
      console.log('Cleanup für UI-Erstellung durchgeführt.');
    }
  });
});

test('Sollte erledigte Aufgaben über den Footer und das Popup massenlöschen', async ({ page, context }) => {
  const csrfToken = await loginAndGetStatus(page, context);

  // 1. Eindeutige Namen für diesen Test festlegen
  const openTaskName = 'CleanUp-Test Offen';
  const completedTaskName = 'CleanUp-Test Erledigt';

 //   await navigateToTodoList(page);
  // 2. SETUP: Zwei Test-Todos direkt über das Backend erstellen
  // Todo A: Bleibt offen
  const openTodoId = await createTestTodo(page, csrfToken, openTaskName);
  
  // Todo B: Wird direkt als ERLEDIGT erstellt
  const responseDone = await page.request.post('http://localhost:8080/api/todos', {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    data: {
      task: completedTaskName, // 👈 Hier setzen wir den Namen ein!
      description: 'Wird gleich gelöscht',
      effort: 1,
      usedEffort: 1,      // 🌟 Aufwand wurde aufgebraucht
      dueDate: Date.now() + 86400000,
      createdAt: Date.now,
      category: 'Allgemein',
      userId: 'e25f0b1b-b387-41fd-bf94-c82ce9e44eab', 
      done: true, // Direkt erledigt!
      isStarted: false
    }
  });
 const doneTodoData = await responseDone.json();
 const completedTodoId = doneTodoData.id;

  try {
 // 3. Auf die Todo-Liste navigieren + kleine Pause per Network-Idle
    await navigateToTodoList(page);
    await page.waitForLoadState('networkidle');

    // 🔄 RELOAD 1: Sicherstellen, dass die frisch erstellten API-Todos geladen sind
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Erst prüfen, wenn das Netzwerk absolut ruhig ist
    await expect(page.getByText(openTaskName)).toBeVisible();
    await expect(page.getByText(completedTaskName)).toBeVisible();

    // 4. Im Footer den Massenlöschen-Trigger klicken
    const clearCompletedSpan = page.getByText('🗑️ Erledigte private Aufgaben löschen');
    await clearCompletedSpan.scrollIntoViewIfNeeded();
    await clearCompletedSpan.click({ force: true });

    // 5. Im Popup auf den richtigen Button klicken
    const confirmPopupButton = page.locator('app-universal-popup-component .popup-confirm-btn');
    await confirmPopupButton.waitFor({ state: 'visible' });
    await confirmPopupButton.click({ force: true });

    // 🔄 RELOAD 2: Dem Backend Zeit geben und die Seite frisch laden, um das Ergebnis zu prüfen
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 6. FINALER CHECK: Jetzt ist alles bombenfest synchronisiert!
    await expect(page.getByText(completedTaskName)).not.toBeVisible();
    await expect(page.getByText(openTaskName)).toBeVisible();

  } finally {
    // 7. CLEANUP: Wir räumen das offene Todo auf
    try {
      await deleteTestTodo(page, csrfToken, openTodoId);
    } catch (e) {
      // Falls es schon weg war
    }
  }
});