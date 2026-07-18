import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../core/services/project/project-service';
import { Milestone } from '../../../core/models/milestone';

/**
 * @component MilestoneSuggestionsComponent
 * @description Diese Komponente rendert die reaktive Seitenleiste mit KI-gestützten Meilenstein-Vorschlägen.
 * Sie unterscheidet zwischen regulären Empfehlungen (recommended) und der "Strafbank" (degraded)[cite: 6].
 * Bereits hinzugefügte Meilensteine werden vollautomatisch ausgeblendet[cite: 9].
 */
@Component({
  selector: 'app-milestone-suggestions-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './milestone-suggestions-component.html',
  styleUrl: './milestone-suggestions-component.css',
})
export class MilestoneSuggestionsComponent {
  /** Der zentrale Projektservice für KI-Interaktionen und Empfehlungen */
  public projectService = inject(ProjectService);

  /** 
   * 📥 Die Liste der bereits im aktuellen Projekt-Rechner vorhandenen Meilensteine.
   * Wird genutzt, um Duplikate reaktiv aus der Vorschlagsliste herauszufiltern[cite: 9].
   */
  public existingMilestones = input<Milestone[]>([]);

  /** 📥 Der aktuelle Projekttitel von der Mutter-Komponente, zwingend erforderlich für KI-Anfragen[cite: 9]. */
  public projectTitle = input.required<string>();

  /** 📢 Event-Output: Informiert die Mutter-Komponente, dass ein Vorschlag angenommen wurde[cite: 9]. */
  public milestoneAccepted = output<string>();
  
  /** 📢 Event-Output: Informiert die Mutter-Komponente, dass ein Vorschlag abgewertet wurde. */
  public milestoneDegraded = output<string>();
  
  /** 📢 Event-Output: Teilt mit, ob die "Strafbank"-Meilensteine gerade sichtbar sind (true) oder nicht (false)[cite: 9]. */
  public degradedAreShown = output<boolean>();

  /** 💡 Berechnete Brille auf das rohe Vorschlags-Signal aus dem Service[cite: 6, 9] */
  public suggestions = computed(() => this.projectService.suggestions());

  /** Lokaler Zustand, ob die Strafbank (degraded) mit eingeblendet werden soll[cite: 6, 9] */
  public showAll = signal<boolean>(false);

  /** 
   * Berechnet vollautomatisch, ob der "Mehr anzeigen"-Button überhaupt sichtbar sein muss.
   * Nur sichtbar, wenn auch tatsächlich abgewertete Elemente existieren[cite: 6, 9].
   */
  public mustShowButtonMore = computed(() => {
    const model = this.suggestions();
    if (!model) return false;
    return model.degraded.length > 0;
  });

  /**
   * Schaltet die Sichtbarkeit der abgewerteten Vorschläge um und sendet den aktuellen Zustand nach außen[cite: 9].
   */
  public toggleShowMore(): void {
    this.showAll.set(!this.showAll());
    this.degradedAreShown.emit(this.showAll());
  }

  /**
   * 🧠 DAS KERNSTÜCK DER REAKTIVITÄT
   * Kombiniert empfohlene und abgewertete Vorschläge basierend auf dem `showAll`-Filter[cite: 9].
   * Schließt danach alle Titel aus, die bereits im Projekt enthalten sind (Case-Insensitive)[cite: 9].
   */
  public readonly shownSuggestions = computed(() => {
    const model = this.suggestions();
    if (!model) return [];
    
    const suggestionsToShow = this.showAll()
        ? [ ...model.recommended, ...model.degraded]
        : model.recommended;

    // Titel aller existierenden Meilensteine als bereinigte Strings im Set sammeln[cite: 9]
    const existingTitles = new Set(
      this.existingMilestones().map(m => m.title.trim().toLowerCase())
    );

    // Filter: Nur Vorschläge behalten, die noch NICHT im Projekt existieren[cite: 9]
    return suggestionsToShow.filter(suggestion => 
      !existingTitles.has(suggestion.title.trim().toLowerCase())
    );
  });

  /**
   * Wird gefeuert, wenn der Nutzer das "+" Icon klickt[cite: 8, 9].
   * Meldet die Akzeptanz an das KI-Backend und triggert das Event an den Projekt-Rechner[cite: 9].
   * 
   * @note Achtung: `projectService.acceptSuggestion` wird aktuell auch in der Mutter-Komponente 
   * gefeuert, sobald das Event dort gefangen wird. Das sorgt für einen doppelten Backend-Aufruf!
   */
  public handleAccept(milestoneTitle: string): void {
    this.projectService.acceptSuggestion(this.projectTitle(), milestoneTitle);
    this.milestoneAccepted.emit(milestoneTitle);
  }

  /**
   * Wird gefeuert, wenn der Nutzer das "❌" Icon klickt[cite: 8, 9].
   * Meldet die Abwertung (Degradierung) direkt an das KI-Backend, um das Modell anzulernen[cite: 9].
   */
  public handleDegrade(milestoneTitle: string): void {
    this.projectService.degradeSuggestion(this.projectTitle(), milestoneTitle);
    // Sollte die Mutter-Komponente hierüber informiert werden müssen, könnte man optional noch emit() nutzen.
  }
}