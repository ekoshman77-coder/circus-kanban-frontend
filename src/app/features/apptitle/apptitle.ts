// apptitle.ts
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/services/user/user-service'; // Pfad zu deinem UserService prüfen!
import { ConnectionService } from '../../core/services/connection-service';

@Component({
  selector: 'app-apptitle',
  standalone: true,
  imports: [CommonModule], // CommonModule für reaktives HTML aktivieren
  templateUrl: './apptitle.html',
  styleUrl: './apptitle.css',
})
export class Apptitle {
  private userService = inject(UserService);
  public connectionService = inject(ConnectionService);

  // 1. Wir greifen auf das reaktive Signal aus dem UserService zu
  public gamification = computed(() => this.userService.gamificationSignal());

  // 2. 🧮 Die magische Prozentformel mit dem Schutz gegen Überlauf und XP-Schulden!
  public progressPercent = computed(() => {
    const state = this.gamification();
    
    // Wie viel XP umfasst das aktuelle Level insgesamt? (z.B. 250 - 100 = 150)
    const range = state.nextLevelXpRequired - state.currentLevelXpStart;
    if (range <= 0) return 100; // Max Level abgefangen

    // Wie viele XP hat der User innerhalb des aktuellen Levels gesammelt?
    const gainedInCurrentLevel = state.currentXp - state.currentLevelXpStart;
    
    // Reine mathematische Prozentberechnung
    const percent = Math.round((gainedInCurrentLevel / range) * 100);
    
    // 🛡️ Die elegante Eingrenzung: Schützt vor Werten unter 0% und über 100%
    return Math.max(0, Math.min(100, percent));
  });
}