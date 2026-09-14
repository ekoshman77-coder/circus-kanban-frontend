import { InjectionToken } from '@angular/core';

export interface IAuthContext {
  isLoggedIn(): boolean;
  getCurrentUserId(): string | null;
}

// 🟢 Hier fehlte :
export const AUTH_CONTEXT = new InjectionToken< IAuthContext >('AUTH_CONTEXT');