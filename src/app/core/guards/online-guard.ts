import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConnectionService } from '../services/connection-service';
import { filter, map, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';


export const onlineGuard: CanActivateFn = (route, state) => {
  const connectionService = inject(ConnectionService);
  const router = inject(Router);

  // 1. Wir wandeln das schlanke status-Signal in ein RxJS-Observable um
  return toObservable(connectionService.status).pipe(
    // 2. 🛡️ Das ist das Wichtigste: Wir filtern 'UNKNOWN' einfach eiskalt heraus!
    // Der Guard wartet hier so lange, bis der Status ENTWEDER 'ONLINE' ODER 'OFFLINE' ist.
    filter(status => status !== 'UNKNOWN'),
    
    // 3. Sobald der Status feststeht, nehmen wir genau diesen ersten gültigen Wert (take(1))
    take(1),
    
    // 4. Jetzt mappen wir das Ergebnis auf die Erlaubnis oder die Umleitung
    map(status => {
      if (status === 'OFFLINE') {
        // 🌟 Deine bewährte Offline-Umleitung
        if (!router.navigated) {
          return router.createUrlTree(['/todopage'], { queryParams: { reason: 'offline' } }); //
        } 
        return router.createUrlTree([router.url], { queryParams: { reason: 'offline' } }); //
      }
      
      // Bei 'ONLINE' darf der User die Seite betreten!
      return true;
    })
  );
};