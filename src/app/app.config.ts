import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Token } from '@angular/compiler';
import { withCredentialsInterceptor } from './core/interceptors/with-credentials';
import { authErrorInterceptor } from './core/interceptors/auth-error-intercaptor';

export const appConfig: ApplicationConfig = {
  providers: [
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
    provideAnimations()
  ]
};
