import { Provider, signal } from '@angular/core';
import { vi } from 'vitest';
import { CentralQueueService } from '../../src/app/core/services/central-queue/central-queue-service';
import { NotificationService } from '../../src/app/core/services/notification/notification-service';
import { LocalStorageService } from '../../src/app/core/services/user/local-storage-service';
import { AUTH_CONTEXT } from '../../src/app/core/services/user/auth-context';
import { Subject } from 'rxjs';
import { UserService } from '../../src/app/core/services/user/user-service';

export const mockAuthContext = {
  getCurrentUserId: vi.fn().mockReturnValue('test-user-123'),
  isLoggedIn: vi.fn().mockReturnValue(true),
  userRole: 'ADMIN'
};

export const mockCentralQueueService = {
  registerService: vi.fn(),
  hasPendingItems: vi.fn().mockReturnValue(false),
  updateEntityIdInQueue: vi.fn(),
  removeItemsForEntity: vi.fn(),
  enqueue: vi.fn()
};

export const mockNotificationService = {
  showNotification: vi.fn()
};

export const mockLocalStorageService = {
  register: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  addDataNotSaved: vi.fn(),
  collectUnsavedDataWarnings: vi.fn().mockReturnValue([])
};

export const mockUserService = {  
    currentUser: signal({ id: 'user-123', username: 'TestUser' }),
    getCurrentUserId: vi.fn(() => 'user-123'),
    isLoggedIn: vi.fn(() => true),
    onLogout$: new Subject(), 
    updateGamification: vi.fn()  
}

/**
 * 🧹 Bündelt alle Core-Provider für Component-Tests
 */
export function getCoreTestProviders(): Provider[] {
  return [
    { provide: AUTH_CONTEXT, useValue: mockAuthContext },
    { provide: CentralQueueService, useValue: mockCentralQueueService },
    { provide: NotificationService, useValue: mockNotificationService },
    { provide: LocalStorageService, useValue: mockLocalStorageService },
    { provide: UserService, useValue: mockUserService },
  ];
}