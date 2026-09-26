import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, Type } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { withCredentialsInterceptor } from './core/interceptors/with-credentials';
import { authErrorInterceptor } from './core/interceptors/auth-error-intercaptor';
import { AUTH_CONTEXT } from './core/services/user/auth-context';
import { UserService } from './core/services/user/user-service';
import { QueueHandlerName } from './core/enums/queue-handler-name';
import { DepartmentDataManager } from './core/services/admin/department-data-manager';
import { NoteDataManagerService } from './core/services/note/note-data-manager-service';
import { UserSettingsDataManager } from './core/services/user/user-settings-data-manager';
import { IQueueHandler } from './core/services/central-queue/queue-handler-interface';
import { AdminTeamManager } from './core/services/admin/admin-team-manager';
import { PlannerDataManagerService } from './core/services/ai/planner-data-manager-service';
import { FocusDataManagerService } from './core/services/focus/focus-data-manager-service';
import { PermissionDataManager } from './core/services/permissions/permission-data-manager';
import { ProjectDataManagerService } from './core/services/project/project-data-manager-service';
import { TeamDataManager } from './core/services/team/team-data-manager';
import { TodoDataManagerService } from './core/services/todo/todo-data-manager-service';
import { DraftService } from './core/services/draft-chains/draft-service';

const DATA_MANAGER_REGISTRY: Record<QueueHandlerName, Type<IQueueHandler>> = {
[QueueHandlerName.ADMIN_TEAM]: AdminTeamManager,
  [QueueHandlerName.DEPARTMENT]: DepartmentDataManager,
  [QueueHandlerName.PLANNER]: PlannerDataManagerService,
  [QueueHandlerName.NOTE]: NoteDataManagerService,
  [QueueHandlerName.USER_SETTINGS]: UserSettingsDataManager,
  [QueueHandlerName.FOCUS]: FocusDataManagerService,
  [QueueHandlerName.PERMISSION]: PermissionDataManager,
  [QueueHandlerName.PROJECT]: ProjectDataManagerService,
  [QueueHandlerName.TEAM]: TeamDataManager,
  [QueueHandlerName.TODO]: TodoDataManagerService,
};

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: AUTH_CONTEXT, useExisting: UserService },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN'
      }),
      withInterceptors([
        withCredentialsInterceptor,
        authErrorInterceptor
      ])
    ),
    
    // 🚀 Der moderne Angular Initializer:
    provideAppInitializer(() => {
      Object.values(DATA_MANAGER_REGISTRY).forEach(managerClass => {
        inject(managerClass);
      });
      inject(DraftService)
    }),

    provideAnimations(),
  ]
};