import { Component, computed, inject, signal, OnInit } from '@angular/core'; // 👈 1. HIER OnInit importiert
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user-service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './welcome-component.html',
  styleUrl: './welcome-component.css'
})
export class WelcomeComponent implements OnInit { 
  public userService = inject(UserService);
  public usernameInput = signal<string>('');
  public firstNameInput = signal<string>('');
  public lastNameInput = signal<string>('');

  public errorMessage = signal<string>(''); 
  public isLoading = signal<boolean>(false); 
  public recentUsers = signal<string[]>([]);   

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
    this.usernameInput.set(name);
    this.onLogin();
  }

  isForwardButtonDisabled = computed(() => {
    if (this.isLoading()) return true;
    const currentInput = this.usernameInput().trim();
    if (this.userService.isLoggedIn()) {
      return currentInput !== '';
    }
    return currentInput === '';
  });

public onLogin(): void {
    const name = this.usernameInput().trim();
    if (!name) return;

    this.isLoading.set(true);

    this.userService.login(name).subscribe({
      next: (user) => {
        this.saveUserToRecent(user.username);
        this.errorMessage.set('');
        this.usernameInput.set('');
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);

        if (err.status === 404 || err.status === 401) {
          // 🔍 HIER PRÜFEN WIR: War der Name in unseren "Zuletzt eingeloggt"-Badges?
          const wasInLocalStorage = this.recentUsers().includes(name);

          if (wasInLocalStorage) {
            // Fall 1: Der User war im LocalStorage, existiert aber in der DB nicht mehr (z.B. nach DB-Reset)
            this.errorMessage.set(`Es tut mir leid, der Benutzer "${name}" existiert nicht mehr in unserer Datenbank. Bitte erstelle ein neues Board! ✨`);
            
            // 🧹 Aus der lokalen Liste entfernen
            const filteredList = this.recentUsers().filter(u => u !== name);
            this.recentUsers.set(filteredList);
            localStorage.setItem('recent_todos_users', JSON.stringify(filteredList));
            
            // Input leeren, da der alte Name hinfällig ist
            this.usernameInput.set('');
          } else {
            // Fall 2: Ein ganz neuer Name wurde eingetippt, den die DB einfach (noch) nicht kennt
            this.errorMessage.set(`Der Name "${name}" wurde nicht gefunden. Wenn du neu hier bist, klicke einfach auf "Neues Board erstellen"! 🚀`);
            // Hier lassen wir den Namen im Input stehen, damit der User direkt auf "Registrieren" klicken kann!
          }

        } else {
          // Ein anderer Fehler (z.B. Server komplett offline)
          this.errorMessage.set(err.error?.error || 'Verbindung zum Server fehlgeschlagen.');
        }
      }
    });
  }

public onRegister(): void {
    const username = this.usernameInput().trim();
    const firstName = this.firstNameInput().trim();
    const lastName = this.lastNameInput().trim();

    // Validierung: Für die Registrierung brauchen wir jetzt alle drei!
    if (!username || !firstName || !lastName) {
      this.errorMessage.set('Bitte fülle alle Felder (Username, Vorname, Nachname) aus! ✨');
      return;
    }

    this.isLoading.set(true); //[cite: 4]

    // 🔄 Wir übergeben alle drei Parameter an deinen Service!
    this.userService.register(username, firstName, lastName).subscribe({
      next: (user) => {
        this.saveUserToRecent(user.username); //[cite: 4]
        this.errorMessage.set(''); //[cite: 4]
        
        // Alle Felder nach erfolgreicher Registrierung leeren 🧹
        this.usernameInput.set(''); //[cite: 4]
        this.firstNameInput.set('');
        this.lastNameInput.set('');
        
        this.isLoading.set(false); //[cite: 4]
      },
      error: (err: string) => {
        this.errorMessage.set(err || 'Registrierung fehlgeschlagen.'); //[cite: 4]
        this.isLoading.set(false); //[cite: 4]
      }
    });
  }
}