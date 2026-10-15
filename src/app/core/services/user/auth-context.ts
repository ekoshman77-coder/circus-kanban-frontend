import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface IAuthContext {
  isLoggedIn(): boolean;
  getCurrentUserId(): string | null;
  onLogout$: Observable<void>;
}

// 🟢 Hier fehlte :
export const AUTH_CONTEXT = new InjectionToken< IAuthContext >('AUTH_CONTEXT');