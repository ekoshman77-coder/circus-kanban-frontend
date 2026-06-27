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

  // 📥 Wir brauchen den Projekttitel von der Mutter-Komponente, um Meilensteine hinzuzufügen
  public projectTitle = input.required<string>();

  // 📢 Die Verbindung nach draußen! Schickt den Titel des Meilensteins an den Calculator
  public milestoneAccepted = output<string>();

  public suggestions = computed(() => this.projectService.recommendedSuggestions())

  public showAll = computed(() => this.projectService.showAll())

  public toggleShowMore(): void {
    if (this.showAll()) {
      this.projectService.showLess()
    } else {
      this.projectService.showMore()
    }
  }

  public showLess(): void {
    this.projectService.showLess()
  }
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
