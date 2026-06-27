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
  public isNewUser = signal<boolean>(false); 

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
    this.isNewUser.set(false); // 🧹 Erstmal zurücksetzen

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
          // 🔔 Der Server sagt: User existiert nicht -> Registrierung aufmachen!
          this.isNewUser.set(true); 
          
          const wasInLocalStorage = this.recentUsers().includes(name);

          if (wasInLocalStorage) {
            this.errorMessage.set(`Der Benutzer "${name}" existiert nicht mehr in der Datenbank. Bitte fülle die Felder unten aus, um dein Board neu zu erstellen! ✨`);
            
            // Aus der lokalen Liste entfernen
            const filteredList = this.recentUsers().filter(u => u !== name);
            this.recentUsers.set(filteredList);
            localStorage.setItem('recent_todos_users', JSON.stringify(filteredList));
          } else {
            this.errorMessage.set(`Der Name "${name}" wurde nicht gefunden. Bitte trage deine Daten unten ein, um ein neues Board zu erstellen! 🚀`);
          }
          
          // Name im Input stehen lassen
          this.usernameInput.set(name);

        } else {
          this.errorMessage.set(err.error?.error || 'Verbindung zum Server fehlgeschlagen.');
        }
      }
    });
  }

public onRegister(): void {
    const username = this.usernameInput().trim();
    if (!username) {
      this.errorMessage.set('Bitte gib zuerst einen Benutzernamen ein! ✨');
      return;
    }

    // 🌟 SCHRITT 1: Wenn die Felder noch ZU sind, machen wir sie jetzt einfach AUF!
    if (!this.isNewUser()) {
      this.isNewUser.set(true);
      this.errorMessage.set(''); // Eventuelle alte Fehler löschen
      return; // Hier stoppen wir! Der User soll erst tippen.
    }

    // 🌟 SCHRITT 2: Wenn die Felder schon AUF sind, validieren und registrieren wir echt!
    const firstName = this.firstNameInput().trim();
    const lastName = this.lastNameInput().trim();

    if (!firstName || !lastName) {
      this.errorMessage.set('Bitte fülle alle Felder (Vorname und Nachname) aus! ✨');
      return;
    }

    this.isLoading.set(true);

    this.userService.register(username, firstName, lastName).subscribe({
      next: (user) => {
        this.saveUserToRecent(user.username);
        this.errorMessage.set('');
        this.isNewUser.set(false); // Formular wieder einklappen
        
        // Felder leeren
        this.usernameInput.set('');
        this.firstNameInput.set('');
        this.lastNameInput.set('');
        this.isLoading.set(false);
      },
      error: (err: string) => {
        this.errorMessage.set(err || 'Registrierung fehlgeschlagen.');
        this.isLoading.set(false);
      }
    });
  }
}