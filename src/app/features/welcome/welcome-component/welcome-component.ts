import { Component, computed, inject, signal, OnInit, effect, OnDestroy } from '@angular/core'; // 👈 1. HIER OnInit importiert
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { ApprovalPollingService } from '../../../core/services/admin/approval-polling-service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, UniversalPopupComponent],
  templateUrl: './welcome-component.html',
  styleUrl: './welcome-component.css'
})
export class WelcomeComponent implements OnInit {
  public userService = inject(UserService);
  private notificationService = inject(NotificationService); 
  private approvalService = inject(ApprovalPollingService)
  private router = inject(Router);

  public registerForm = new FormGroup({
    username: new FormControl("", Validators.required),
    password: new FormControl("", Validators.required),
    firstName: new FormControl(""),
    lastName: new FormControl(""),
  })

  public errorMessage = signal<string>('');
  public isLoading = signal<boolean>(false);
  public recentUsers = signal<string[]>([]);
  public isNewUser = signal<boolean>(false);
  public popupProcessedFor = signal<'login' | 'logout' | 'register' | null>(null)

  public logoutWarnings = computed(() => {
    const w = this.userService.warnings();
    return (w && w.length > 0) ? w : null;
  });

  public showPassword = signal<boolean>(false);

  public togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

 constructor() {
    // 🎯 REAKTIVER EFFEKT: Lauscht NUR auf das flüchtige Freischaltungs-Signal!
    effect(() => {
      if (this.approvalService.justApproved()) {
        const user = this.userService.currentUser();
        console.log('🎉 Warteraum-Erfolg! Komponente leitet weiter...');
        
        this.router.navigate(['/todopage']);
        this.notificationService.showNotification(
          `Willkommen an Bord, ${user?.firstName}! Dein Account wurde freigeschaltet. 🎉`, 
          'success'
        );
      }
    });
  }

  ngOnInit(): void {
    // Wird jetzt garantiert beim Start ausgeführt!
    const saved = localStorage.getItem('recent_todos_users');
    if (saved) {
      this.recentUsers.set(JSON.parse(saved));
    }
  }

  private saveUserToRecent(name: string): void {
    const currentList = this.recentUsers();
    if (!currentList.includes(name)) {
      const updatedList = [name, ...currentList].slice(0, 3);
      this.recentUsers.set(updatedList);
      localStorage.setItem('recent_todos_users', JSON.stringify(updatedList));
    }
  }

  public selectRecentUser(name: string): void {
    this.registerForm.get("username")?.setValue(name);
  }

  isForwardButtonDisabled = computed(() => {
    if (this.isLoading()) return true;
    const currentInput = (this.registerForm.get('username')?.value ?? "").trim();
    if (this.userService.isLoggedIn()) {
      return currentInput !== '';
    }
    return currentInput === '';
  });

public onLogin(): void {
    const name = (this.registerForm.get("username")?.value ?? "").trim();
    const password = (this.registerForm.get("password")?.value ?? "").trim();

    if (!name || !password) {
      this.errorMessage.set('Bitte gib sowohl deinen Namen als auch dein Passwort ein! 🔒');
      return;
    }

    this.isLoading.set(true);
    this.isNewUser.set(false);
    this.popupProcessedFor.set('login');

    this.userService.login(name, password).subscribe({
      next: (user) => {
        if (!user) {
          this.isLoading.set(false); 
          return;
        }
        this.saveUserToRecent(user.username);
        this.errorMessage.set('');
        this.registerForm.reset();
        this.isLoading.set(false);
        this.popupProcessedFor.set(null);

        // 🚀 WEITERLEITUNG WEGEN LOGIN: 
        // Wenn der User sich einloggt UND bereits approved ist, leiten wir IHN HIER DIREKT WEITER!
        if (user.isApproved) {
          this.router.navigate(['/todopage']);
          this.notificationService.showNotification(`Willkommen zurück, ${user.firstName}! 👋`, 'success');
        }
      },
      error: (err) => {
        this.popupProcessedFor.set(null);
        this.isLoading.set(false);
      }
    });
  }

  public onCancel() {
    this.userService.cancelLogout(); // 👈 WICHTIG: Service Bescheid geben!
    this.popupProcessedFor.set(null);
    this.isLoading.set(false); // 👈 Spinner stoppen, falls es vom Login/Register kam
  }

  public onContinue() {
    switch (this.popupProcessedFor()) {
      case 'login': this.onLogin();
        break;
      case 'logout': this.onLogout();
        break;
      case 'register': this.onRegister()
    }
    this.popupProcessedFor.set(null)
  }

  public onLogout() {
    this.popupProcessedFor.set("logout");
    if (this.userService.logout()) {
      this.popupProcessedFor.set(null)
    }
  }

  public onRegister(): void {
    // 1. Auslesen aller Werte über das coole Destructuring, das wir besprochen haben
    const { username, firstName, lastName, password, } = this.registerForm.value;

    // Sicherheitscheck für den Benutzernamen (wie vorher)
    if (!username?.trim()) {
      this.errorMessage.set('Bitte gib zuerst einen Benutzernamen ein! ✨');
      return;
    }

    // 🌟 SCHRITT 1: Wenn die Felder noch ZU sind, machen wir sie jetzt einfach AUF!
    if (!this.isNewUser()) {
      this.isNewUser.set(true);
      this.errorMessage.set('');
      return; // Hier stoppen wir! Der User soll erst tippen.
    }

    // 🌟 SCHRITT 2: Die Felder sind offen! JETZT validieren wir manuell:
    if (!firstName?.trim() || !lastName?.trim() || !password?.trim()) {
      this.errorMessage.set('Bitte fülle alle Felder (Vorname, Nachname und Passwort) aus! ✨');
      return;
    }

    if (password.length < 6) {
      this.errorMessage.set('Das Passwort muss mindestens 6 Zeichen lang sein! 🔒');
      return;
    }

    // 🚀 WENN ALLES OK IST: Ab zum Backend!
    this.isLoading.set(true);
    this.popupProcessedFor.set('register')

    // HIER rufen wir jetzt deinen Service mit allen 5 Werten auf!
    this.userService.register(username ?? "", firstName ?? "", lastName ?? "", password ?? "").subscribe({
      next: (user) => {
        if (!user) {
          this.isLoading.set(false);
          return
        }
        this.popupProcessedFor.set(null)
        this.saveUserToRecent(user.username);
        this.errorMessage.set('');
        this.isNewUser.set(false); // Wieder einklabben

        // 🪄 Der magische Reset, den du herausgefunden hast!
        this.registerForm.reset();
        this.isLoading.set(false);
      },
      error: (err: string) => {
        this.errorMessage.set(err || 'Registrierung fehlgeschlagen.');
        this.popupProcessedFor.set(null)
        this.isLoading.set(false);
      }
    });
  }
}