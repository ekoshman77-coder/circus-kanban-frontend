import { Component, signal, inject, effect, computed, OnInit } from '@angular/core'; // ✨ inject importiert
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { Apptitle } from './features/apptitle/apptitle';
import { UserService } from './core/services/user/user-service'; // 👈 Pfad zu deinem UserService anpassen
import { ConnectionService } from './core/services/connection/connection-service';
import { filter } from 'rxjs';
import { NavigationHistoryService } from './core/services/navigation/navigation-history-service';
import { IdeaBoardComponent } from './features/idea-board/idea-board-component/idea-board-component';
import { NotificationComponent } from './features/notification/notification-component/notification-component';
import { FilterComponent } from './features/todo/filter-component/filter-component';
import { SearchCenterComponent } from './features/global-search/search-center-component/search-center-component';
import { FilterService } from './core/services/filter/filter-service';

@Component({
  selector: 'app-root',
  imports: [Apptitle, RouterLink, RouterOutlet, RouterLinkActive, NotificationComponent, SearchCenterComponent], // 'Home' und 'TodoPageComponent' fliegen hier raus, da sie über den Router geladen werden!
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  // 👥 Wir injizieren den UserService, um den Login-Status global abzufragen
  public userService = inject(UserService);
  public connectionService = inject(ConnectionService)
  private navigationHistory = inject(NavigationHistoryService);

  
  private filterService = inject(FilterService);

  // 2. Die Werte als einfache computed Signals für dein HTML bereitstellen
  protected searchTerm = computed(() => this.filterService.searchTerm());
  protected currentCategory = computed(() => this.filterService.currentCategory());
  showOfflineBanner = signal<boolean>(false);

  public isOffline = computed(() => this.connectionService.isOffline());
  protected readonly title = signal('schulung');

  private router = inject(Router);

  constructor() {
    // 🌟 Ein eigener Effekt NUR für das UI-Routing!
    effect(() => {
      const isLoggedIn = this.userService.isLoggedIn();
      
      if (!isLoggedIn) {
        console.log('UI-Wächter: User ist ausgeloggt. Navigiere zu /welcome');
        this.router.navigate([''], { queryParams: { reason: 'session_expired' } });
      }
    });
  }
ngOnInit() {
    // Jedes Mal, wenn der Router eine Navigation beendet (auch wenn man auf derselben Seite bleibt)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Wir holen uns die Parameter der aktuellen Route
      const params = this.router.parseUrl(this.router.url).queryParams;
      
      if (params['reason'] === 'offline') {
        this.showOfflineBanner.set(true);
        
        // Optionale Kosmetik: Wir putzen das '?reason=offline' heimlich aus der Adresszeile,
        // damit es beim manuellen Browser-Reload nicht wieder triggert. Das Banner bleibt aber offen!
        const currentUrlWithoutParams = this.router.url.split('?')[0];
        this.router.navigate([currentUrlWithoutParams], { replaceUrl: true });
      }
    });
  }

  closeBanner() {
    this.showOfflineBanner.set(false);
  }
}