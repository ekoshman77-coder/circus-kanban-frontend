import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ProjectService } from '../../../core/services/project-service';

@Component({
  selector: 'app-milestone-suggestions-component',
  imports: [],
  templateUrl: './milestone-suggestions-component.html',
  styleUrl: './milestone-suggestions-component.css',
})
export class MilestoneSuggestionsComponent {
  public projectService = inject(ProjectService);

  // 🔥 NEU: Holt die Liste der bereits im Calculator vorhandenen Meilensteine
  public existingMilestones = input<any[]>([]);

  // 📥 Wir brauchen den Projekttitel von der Mutter-Komponente, um Meilensteine hinzuzufügen
  public projectTitle = input.required<string>();

  // 📢 Die Verbindung nach draußen! Schickt den Titel des Meilensteins an den Calculator
  public milestoneAccepted = output<string>();
  public milestoneDegraded = output<string>()
  public degradedAreShown = output<boolean>()

  public suggestions = computed(() => this.projectService.suggestions())

  public showAll = signal<boolean>(false)

  public mustShowButtonMore = computed(() => {
    if (!this.suggestions()) {
      return false
    }
    return this.suggestions()!.degraded.length > 0
  })

  public toggleShowMore(): void {
    this.showAll.set(!this.showAll())
    this.degradedAreShown.emit(this.showAll())
  }

  // Die Component holt sich hieraus blind die empfohlenen Meilensteine
  public readonly shownSuggestions = computed(() => {
    const model = this.suggestions();
    if (!model) {
      return []
    }
    const suggestionsToShow = this.showAll()
        ? [ ...model.recommended, ...model.degraded]
        : model.recommended

    // Die Titel aller bereits existierenden Meilensteine als bereinigte Strings sammeln
    const existingTitles = new Set(
      this.existingMilestones().map(m => m.title.trim().toLowerCase())
    );

    // Filter anwenden: Nur Vorschläge behalten, die noch NICHT im Projekt sind!
    return suggestionsToShow.filter(suggestion => 
      !existingTitles.has(suggestion.title.trim().toLowerCase())
    );
  });

  // Diese Methode wird jetzt von den "+" Buttons aufgerufen
  public handleAccept(milestoneTitle: string): void {
    this.projectService.acceptSuggestion(this.projectTitle(), milestoneTitle);
    
    // Den Calculator informieren, damit er den Meilenstein in die Tabelle einträgt!
    this.milestoneAccepted.emit(milestoneTitle);
  }

  public handleDegrade(milestoneTitle: string) {
    this.projectService.degradeSuggestion(this.projectTitle(), milestoneTitle)
  }
}
