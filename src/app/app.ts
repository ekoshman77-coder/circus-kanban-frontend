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
import { TodoService } from './core/services/todo/todo-service';
import { GamificationResult } from './core/models/gamification';
import confetti from 'canvas-confetti';
import { NotificationService } from './core/services/notification/notification-service';
import { StreakPanelComponent } from './features/streak-panel/streak-panel';

@Component({
  selector: 'app-root',
  imports: [Apptitle, RouterLink, RouterOutlet, RouterLinkActive, NotificationComponent, SearchCenterComponent, StreakPanelComponent], // 'Home' und 'TodoPageComponent' fliegen hier raus, da sie über den Router geladen werden!
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  // 👥 Wir injizieren den UserService, um den Login-Status global abzufragen
  public userService = inject(UserService);
  public connectionService = inject(ConnectionService)
  public todoService = inject(TodoService);
  public notificationService = inject(NotificationService)
  // 🎯 Das globale Signal, das unser HTML mit den frischen Level-Daten füttert
  protected globalLevelUpResult = signal<GamificationResult | null>(null);
  private filterService = inject(FilterService);

  // 2. Die Werte als einfache computed Signals für dein HTML bereitstellen
  protected searchTerm = computed(() => this.filterService.searchTerm());
  protected currentCategory = computed(() => this.filterService.currentCategory());
  showOfflineBanner = signal<boolean>(false);

  public isOffline = computed(() => this.connectionService.isOffline());
  protected readonly title = signal('schulung');

  private router = inject(Router);
  private lastKnownLevel: number | null = null;

constructor() {
    // 🌟 EIN EINZIGER, KONTROLLIERTER EFFEKT FÜR DEN GESAMTEN USER-STATUS
    effect(() => {
      const isLoggedIn = this.userService.isLoggedIn();
      const gamification = this.userService.gamificationSignal();

      // 🛑 FALL 1: User ist nicht eingeloggt
      if (!isLoggedIn) {
        console.log('UI-Wächter: User ist ausgeloggt. Caches zurücksetzen.');
        this.lastKnownLevel = null; // Sofort synchron nullen!
        this.router.navigate([''], { queryParams: { reason: 'session_expired' } });
        return; // Effekt hier abbrechen
      }

      // 🎯 FALL 2: User ist eingeloggt und Gamification-Daten sind da
      if (gamification) {
        const currentLevel = gamification.currentLevel;

        // Sicherheitsnetz: Level 0 ist der initiale Standardwert im Service, den ignorieren wir
        if (currentLevel === 0) {
          return;
        }

        // A) Initialer Zustand nach dem Login:
        // Wir merken uns das Level vom Server, feuern aber kein Konfetti.
        if (this.lastKnownLevel === null) {
          this.lastKnownLevel = currentLevel;
          return;
        }

        // B) Echtes Level-Up während der aktiven Session:
        if (currentLevel > this.lastKnownLevel) {
          console.log(`🎉 LEVEL UP! Von ${this.lastKnownLevel} auf ${currentLevel}`);
          
          this.fireEpicConfetti();
          this.notificationService.showNotification(
            `Aufgestiegen! ${gamification.levelIcon} Du bist jetzt Level ${currentLevel}: ${gamification.levelTitle}!`,
            'success'
          );
        }

        // Zustand für den nächsten Vergleich aktualisieren
        this.lastKnownLevel = currentLevel;
      }
    });
  }  

  private fireEpicConfetti() {
    const duration = 2.5 * 1000; // 2,5 Sekunden dezente Freude
    const end = Date.now() + duration;

    const neonColors = [
      '#ff007f', // Cyber-Pink (knallt extrem gut)
      '#00f5d4', // Neon-Türkis / Mint
      '#7b2cbf', // Intensives Elektro-Lila
      '#ffee32', // Strahlendes Signal-Gelb
      '#39ff14'  // Giftiges Neon-Grün
    ];

    const frame = () => {
      // Linke Kanone
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: neonColors // 👈 Hier die neuen Leuchtfarben rein
      });
      
      // Rechte Kanone
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: neonColors // 👈 Und hier auch
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
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