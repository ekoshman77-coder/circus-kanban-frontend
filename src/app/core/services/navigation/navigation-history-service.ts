import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Service zur intelligenten Verwaltung des internen Navigationsverlaufs.
 * * **Architektur-Vorteil:** Verhindert, dass Benutzer beim Verwenden von "Zurück"-Buttons
 * die App unbeabsichtigt verlassen (z. B. nach einem direkten Einstieg über einen geteilten Link).
 * * Bietet einen sicheren Fallback-Mechanismus, falls der Verlauf durch einen Browser-Refresh (F5) geleert wurde.
 */
@Injectable({
  providedIn: 'root'
})
export class NavigationHistoryService {
  private router = inject(Router);
  
  /** Interner Stack zur Speicherung der tatsächlich besuchten URLs innerhalb der App. */
  private history: string[] = [];

  constructor() {
    // Lauscht reaktiv auf jeden erfolgreich abgeschlossenen Routenwechsel
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.history.push(event.urlAfterRedirects);
      });
  }

  /**
   * Navigiert im internen App-Verlauf genau einen Schritt zurück.
   * * Falls kein Verlauf existiert (z. B. direkter Einstieg oder F5),
   * navigiert die App sicher auf die angegebene Fallback-Route.
   * * @param fallbackRoute Die Ausweich-Route, falls der Stack leer ist (Standard: `/`).
   */
  public back(fallbackRoute: string = '/'): void {
    // Die aktuelle Seite, auf der wir uns gerade befinden, vom Stack entfernen
    this.history.pop(); 

    if (this.history.length > 0) {
      // Wenn noch URLs im Stack liegen, ist das unser Ziel
      const previousUrl = this.history[this.history.length - 1];
      this.router.navigateByUrl(previousUrl);
    } else {
      // Fallback, falls der Stack leer ist
      this.router.navigate([fallbackRoute]);
    }
  }

  /**
   * Hilfsmethode für Unit-Tests, um den aktuellen Stack-Inhalt zu prüfen.
   * @internal
   */
  public getHistoryStack(): string[] {
    return [...this.history];
  }
}