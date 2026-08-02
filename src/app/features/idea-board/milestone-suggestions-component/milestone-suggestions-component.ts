import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../core/services/project/project-service';
import { Milestone } from '../../../core/models/milestone';

/**
 * @component MilestoneSuggestionsComponent
 * @description Diese Komponente rendert die reaktive Seitenleiste mit KI-gestützten Meilenstein-Vorschlägen.
 * Sie unterscheidet zwischen regulären Empfehlungen (recommended) und der "Strafbank" (degraded)
 * Bereits hinzugefügte Meilensteine werden vollautomatisch ausgeblendet
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
   * Wird genutzt, um Duplikate reaktiv aus der Vorschlagsliste herauszufiltern
   */
  public existingMilestones = input<Milestone[]>([]);

  /** 📥 Der aktuelle Projekttitel von der Mutter-Komponente, zwingend erforderlich für KI-Anfragen */
  public projectTitle = input.required<string>();
  public area = input.required<string>()

  /** 📢 Event-Output: Informiert die Mutter-Komponente, dass ein Vorschlag angenommen wurde */
  public milestoneAccepted = output<string>();
  
  /** 📢 Event-Output: Informiert die Mutter-Komponente, dass ein Vorschlag abgewertet wurde. */
  public milestoneDegraded = output<string>();
  
  /** 📢 Event-Output: Teilt mit, ob die "Strafbank"-Meilensteine gerade sichtbar sind (true) oder nicht (false) */
  public degradedAreShown = output<boolean>();

  /** 💡 Berechnete Brille auf das rohe Vorschlags-Signal aus dem Service */
  public suggestions = computed(() => this.projectService.suggestions());

  /** Lokaler Zustand, ob die Strafbank (degraded) mit eingeblendet werden soll */
  public showAll = signal<boolean>(false);

  public isEmpty = computed(() => {
    const model = this.suggestions();
    if (!model) return true;
    return model.recommended.length === 0 && model.degraded.length === 0;
  });

  constructor() {
    effect(() => {
      // Der Effekt horcht NUR auf dieses Signal!
      const emptyNow = this.isEmpty();

      // Wenn isEmpty von true auf false gewechselt hat = Daten frisch geladen!
      if (!emptyNow) {
        // untracked verhindert, dass showAll den Effekt ungewollt triggert
        untracked(() => {
          this.showAll.set(false);
        });
      }
    });
  }

  /** 
   * Berechnet vollautomatisch, ob der "Mehr anzeigen"-Button überhaupt sichtbar sein muss.
   * Nur sichtbar, wenn auch tatsächlich abgewertete Elemente existieren
   */
  public mustShowButtonMore = computed(() => {
    const model = this.suggestions();
    if (!model) return false;
    return model.degraded.length > 0;
  });

  /**
   * Schaltet die Sichtbarkeit der abgewerteten Vorschläge um und sendet den aktuellen Zustand nach außen
   */
  public toggleShowMore(): void {
    this.showAll.set(!this.showAll());
    
    if (this.showAll()) {
      this.projectService.setDegradedWereShown()
    }
    this.degradedAreShown.emit(this.showAll());
  }

  /**
   * 🧠 DAS KERNSTÜCK DER REAKTIVITÄT
   * Kombiniert empfohlene und abgewertete Vorschläge basierend auf dem `showAll`-Filter
   * Schließt danach alle Titel aus, die bereits im Projekt enthalten sind (Case-Insensitive).
   */
  public readonly shownSuggestions = computed(() => {
    const model = this.suggestions();
    if (!model) return [];
    
    const suggestionsToShow = this.showAll()
        ? [ ...model.recommended, ...model.degraded]
        : model.recommended;

    // Titel aller existierenden Meilensteine als bereinigte Strings im Set sammeln
    const existingTitles = new Set(
      this.existingMilestones().map(m => m.title.trim().toLowerCase())
    );

    // Filter: Nur Vorschläge behalten, die noch NICHT im Projekt existieren
    return suggestionsToShow.filter(suggestion => 
      !existingTitles.has(suggestion.title.trim().toLowerCase())
    );
  });

  /**
   * Wird gefeuert, wenn der Nutzer das "+" Icon klickt
   * Meldet die Akzeptanz an das KI-Backend und triggert das Event an den Projekt-Rechner
   * 
   * @note Achtung: `projectService.acceptSuggestion` wird aktuell auch in der Mutter-Komponente 
   * gefeuert, sobald das Event dort gefangen wird. Das sorgt für einen doppelten Backend-Aufruf!
   */
  public handleAccept(milestoneTitle: string): void {
    this.projectService.acceptSuggestion(this.projectTitle(), this.area(), milestoneTitle);
    this.milestoneAccepted.emit(milestoneTitle);
  }

  /**
   * Wird gefeuert, wenn der Nutzer das "❌" Icon klickt
   * Meldet die Abwertung (Degradierung) direkt an das KI-Backend, um das Modell anzulernen
   */
  public handleDegrade(milestoneTitle: string): void {
    this.projectService.degradeSuggestion(this.projectTitle(), this.area(), milestoneTitle);
    // Sollte die Mutter-Komponente hierüber informiert werden müssen, könnte man optional noch emit() nutzen.
  }
}