import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NavigationHistoryService {
  private router = inject(Router);
  
  // Hier drin speichern wir die echten URLs, die der User innerhalb der App besucht
  private history: string[] = [];

  constructor() {
    console.log('🚀 NavigationHistoryService wurde initialisiert!');
    // 🧠 Wir lauschen reaktiv auf jeden erfolgreichen Routenwechsel (NavigationEnd)
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Wir fügen die neue URL zu unserem internen Verlauf hinzu
        this.history.push(event.urlAfterRedirects);
        console.log('📚 Aktueller History-Stack:', [...this.history]);
      });
  }

  /**
   * Navigiert im App-Verlauf einen Schritt zurück.
   * Falls der Verlauf leer ist (z.B. nach einem F5-Browser-Refresh),
   * springt die App sicher auf die angegebene Fallback-Route.
   */
  public back(fallbackRoute: string = '/'): void {
    console.log('↩️ .back() wurde aufgerufen!');
    console.log('📉 History VOR dem Entfernen der aktuellen Seite:', [...this.history]);
    // Die aktuelle Seite (auf der wir gerade stehen) aus dem Stack entfernen
    const current = this.history.pop(); 
    console.log(`🗑️ Aktuelle Seite aus dem Stack geworfen: ${current}`);
    if (this.history.length > 0) {
      // Wenn wir noch eine Seite im Verlauf haben, navigieren wir genau dorthin
      const previousUrl = this.history[this.history.length - 1];
      console.log(`🎯 Navigiere zurück zur vorherigen URL: ${previousUrl}`);
      this.router.navigateByUrl(previousUrl);
    } else {
      console.log(`⚠️ Keine App-History vorhanden! Nutze sicheren Fallback: ${fallbackRoute}`);
      // Sicheres Netz, falls die Historie leer war
      this.router.navigate([fallbackRoute]);
    }
  }
}