import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user/user-service'; // 👈 Pfad zu deinem UserService anpassen

export const authGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const router = inject(Router);

  // Wenn der User eingeloggt ist, darf er passieren!
  if (userService.isLoggedIn()) {
    return true;
  }

  // Wenn nicht, leiten wir ihn knallhart zur Startseite (Login) um
  console.warn('Zugriff verweigert: Du musst dich zuerst einloggen!');
  router.navigate(['/']);
  return false;
};