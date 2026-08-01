import { Page, expect } from '@playwright/test';

// 1. TODO ERSTELLEN (Gibt die ID des Todos zurück, damit wir es später löschen können)
export async function createTestTodo(page: Page, csrfToken: string, taskName: string): Promise<string> {
  const response = await page.request.post('http://localhost:8080/api/todos', {
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken
    },
    data: {
      task: taskName,
      description: 'Automatisiertes Test-Todo',
      effort: 1,
      dueDate: Date.now() + 86400000,
      category: 'Allgemein',
      userId: 'e25f0b1b-b387-41fd-bf94-c82ce9e44eab', 
      done: false,
      isStarted: false
    }
  });

  // Wir stellen sicher, dass das Backend "OK" oder "Created" (Status 200/201) geantwortet hat
  expect(response.ok()).toBeTruthy();
  
  // Wir lesen die Antwort aus, um an die ID des neuen Todos zu kommen
  const responseData = await response.json();

  console.log('--- DEBUG START: Backend Antwort für:', taskName);
  console.log('Komplettes Objekt vom Server:', JSON.stringify(responseData, null, 2));
  console.log('Ausgelesene ID:', responseData.id);
  console.log('--- DEBUG END ---');

  return responseData.id; 
}

// 2. TODO LÖSCHEN (Nutzt die ID nach dem Test)
export async function deleteTestTodo(page: Page, csrfToken: string, todoId: string) {
  const response = await page.request.delete(`http://localhost:8080/api/todos/${todoId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken
    }
  });
if (!response.ok()) {
    console.error(`🚨 LÖSCHEN FEHLGESCHLAGEN für ID: ${todoId}`);
    console.error(`Status vom Server: ${response.status()} (${response.statusText()})`);
    
    try {
      const errorText = await response.text();
      console.error(`Server-Fehlermeldung: ${errorText}`);
    } catch (e) {
      console.error('Kein Fehler-Body vom Server gesendet.');
    }
  }

  // Da Spring "204 No Content" zurückgibt, ist response.ok() bei Status 204 trotzdem TRUE.
  expect(response.ok()).toBeTruthy();
}