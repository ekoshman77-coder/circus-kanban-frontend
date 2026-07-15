import { Component, Input } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';

@Component({
  selector: 'app-stats-performance',
  standalone: true,
  imports: [CommonModule, PercentPipe],
  templateUrl: './stats-performance-component.html',
  styleUrl: './stats-performance-component.css'
})
export class StatsPerformanceComponent {
  @Input({ required: true }) mode: StatMode = 'tasks';
  @Input({ required: true }) completedTodos: any[] = [];

  // 1. Aufgaben-Modus: Express-Aufgaben zählen
  protected get expressCount(): number {
    // Da jedes Todo-Modell jetzt selbst weiß, ob es "Express" ist:
    return this.completedTodos.filter(t => t.isExpress).length;
  }

  protected get expressRatio(): number {
    if (this.completedTodos.length === 0) return 0;
    return this.expressCount / this.completedTodos.length;
  }

  // 2. Punkte-Modus: Schätz-Effizienz berechnen
  protected get totalPlannedPoints(): number {
    return this.completedTodos.reduce((sum, t) => sum + (t.effort || 0), 0);
  }

  protected get totalUsedPoints(): number {
    return this.completedTodos.reduce((sum, t) => sum + (t.usedEffort || 0), 0);
  }

  protected get estimationEfficiency(): number {
    if (this.totalUsedPoints === 0) return 0;
    return this.totalPlannedPoints / this.totalUsedPoints;
  }

  // 🎯 Predictability Score (Planungs-Genauigkeit in %)
  protected get predictabilityScore(): number {
    if (this.completedTodos.length === 0) return 0;
    const exactMatches = this.completedTodos.filter(t => t.usedEffort === t.effort).length;
    return exactMatches / this.completedTodos.length;
  }

  // 🕵️‍♂️ Ehrlichkeits-Tracker (Summe aller nachträglichen Schätzungs-Änderungen)
  protected get totalEffortManipulations(): number {
    return this.completedTodos.reduce((sum, t) => sum + (t.effortChangesCount || 0), 0);
  }

  // Dynamischer Farbcode & Feedback-Text je nach Effizienz
  protected get efficiencyMeta() {
    const eff = this.estimationEfficiency;
    if (eff === 0) return { color: '#64748b', bg: '#f1f5f9', text: 'Noch keine Daten verfügbar.' };

    if (eff >= 0.9 && eff <= 1.1) {
      return { color: '#166534', bg: '#dcfce7', text: '🎯 Perfekt geschätzt! Du kennst dein Tempo genau.' };
    }
    if (eff > 1.1) {
      return { color: '#1e40af', bg: '#dbeafe', text: '🚀 Express-Tempo! Du warst im Schnitt schneller als deine Schätzungen.' };
    }
    return { color: '#9a3412', bg: '#ffedd5', text: '🥵 Komplexe Hürden! Du hast im Schnitt länger gebraucht als geplant.' };
  }

  // Dynamischer Motivationstext für die Planungsgenauigkeit
  protected get predictabilityMeta() {
    const score = this.predictabilityScore * 100;
    if (score >= 80) return { color: '#166534', text: '🧙‍♂️ Meister-Stratege! Deine Punktlandungen sind überragend.' };
    if (score >= 50) return { color: '#1e40af', text: '📋 Solider Planer! Du kannst deine Kraft gut einschätzen.' };
    return { color: '#b45309', text: '🏃‍♂️ Fleißiger Macher! Nimm dir beim Schätzen ruhig etwas mehr Zeit.' };
  }

  protected get predictabilityHue(): number {
    // Nimmt den Score (0 bis 1) und wandelt ihn in einen Winkel zwischen 0 und 120 um
    return this.predictabilityScore * 120;
  }

protected get averageLeadTime(): number {
    if (this.completedTodos.length === 0) return 0;

    const totalDays = this.completedTodos.reduce((sum, t) => {
      if (!t.completedAt || !t.createdAt) return sum;
      
      const diffMs = Math.abs(t.completedAt - t.createdAt);
      const diffDays = diffMs / (1000 * 60 * 60 * 24); // Exakte Tage als Dezimalzahl
      return sum + diffDays;
    }, 0);

    const average = totalDays / this.completedTodos.length;
    
    // Wir runden auf eine Nachkommastelle (z.B. 1.3 Tage). 
    // Wenn es sehr schnell ging (unter 0.1 Tagen), zeigen wir mindestens 0.1 an oder runden sauber.
    return Math.round(average * 10) / 10;
  }

  protected get leadTimeMeta() {
    const days = this.averageLeadTime;
    if (this.completedTodos.length === 0) return { color: '#64748b', text: 'Noch keine Daten.' };

    if (days <= 1) {
      return { color: '#166534', text: '⚡ Überschall-Tempo! Aufgaben fliegen regelrecht bei dir durch.' };
    }
    if (days <= 3) {
      return { color: '#1e40af', text: '🏃‍♂️ Guter Rhythmus! Deine Aufgaben bleiben nicht lange liegen.' };
    }
    return { color: '#b45309', text: '🐢 Gemächlicher Fluss! Manche Aufgaben brauchen etwas Reifezeit.' };
  }

  // 🔥 Der Streak-Counter (Tage in Folge)
  protected get currentStreak(): number {
    if (this.completedTodos.length === 0) return 0;

    // 1. Alle Erledigt-Daten extrahieren und in ein reines "YYYY-MM-DD" Format bringen
    const completedDates = this.completedTodos
      .filter(t => t.completedAt)
      .map(t => {
        const date = new Date(t.completedAt);
        // local date string erzeugen (verhindert Zeitzonen-Verschiebungen)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });

    // 2. Duplikate eliminieren mittels Set (Mehrere Tasks pro Tag zählen als 1 Tag)
    const uniqueDates = new Set(completedDates);

    let streak = 0;
    const checkDate = new Date(); // Wir starten die Prüfung bei HEUTE

    // Hilfsfunktion, um ein Date-Objekt in unseren Such-String umzuwandeln
    const getFormattedString = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Sonderprüfung: Wenn heute nichts erledigt wurde, schauen wir, ob gestern was war.
    // Wenn gestern auch nichts war, ist der Streak sowieso 0.
    let todayStr = getFormattedString(checkDate);
    if (!uniqueDates.has(todayStr)) {
      // Geh einen Tag zurück zu gestern
      checkDate.setDate(checkDate.getDate() - 1);
      let yesterdayStr = getFormattedString(checkDate);
      if (!uniqueDates.has(yesterdayStr)) {
        return 0; // Weder heute noch gestern was erledigt -> Kette gerissen!
      }
    }

    // 3. Rückwärts-Schleife: Solange wir das Datum im Set finden, erhöhen wir den Streak
    while (uniqueDates.has(getFormattedString(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1); // Einen Tag weiter in die Vergangenheit reisen
    }

    return streak;
  }

  // Dynamische Motivation für den Streak
  protected get streakMeta() {
    const s = this.currentStreak;
    if (s === 0) return { color: '#64748b', text: 'Fang heute eine neue Serie an! 🚀' };
    if (s <= 2) return { color: '#1e40af', text: 'Guter Start! Halte die Kette am Leben. 🌱' };
    if (s <= 5) return { color: '#b45309', text: 'Du bist im Tunnel! Richtig starke Konstanz. 🔥' };
    return { color: '#166534', text: '👑 Unaufhaltbar! Du bist ein absoluter Produktivitäts-Gott!' };
  }
}