import { HttpInterceptorFn } from '@angular/common/http';

export const withCredentialsInterceptor: HttpInterceptorFn = (req, next) => {

// Wenn die Anfrage an die externe Wetter-API geht, lassen wir sie komplett unberührt!
  if (req.url.includes('api.open-meteo.com')) {
    return next(req);
  }

  const getCookie = (name: string): string | null => {
    const nameLenPlus = (name.length + 1);
    return document.cookie
      .split(';')
      .map(c => c.trim())
      .filter(cookie => cookie.substring(0, nameLenPlus) === `${name}=`)
      .map(cookie => decodeURIComponent(cookie.substring(nameLenPlus)))[0] || null;
  };

  const csrfToken = getCookie('XSRF-TOKEN');

  let authReq = req.clone({
    withCredentials: true
  });

  if (csrfToken) {
    authReq = authReq.clone({
      headers: req.headers.set('X-XSRF-TOKEN', csrfToken)
    });
  } else {
    console.warn(` [Interceptor] KEIN XSRF-TOKEN gefunden! Request geht ohne Header raus.`);
  }

  return next(authReq);
};