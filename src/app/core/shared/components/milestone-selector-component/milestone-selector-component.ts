import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { ProjectService } from '../../../services/project-service';

@Component({
  selector: 'app-milestone-selector-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './milestone-selector-component.html',
  styleUrl: './milestone-selector-component.css',
})
export class MilestoneSelectorComponent {
  private projectService = inject(ProjectService);
  public isDisabled = input<boolean>(false);
  
  // ⚙️ DIE DREI STEUER-INPUTS FÜR UNSERE VARIANTEN:
  public canChooseProject = input<boolean>(false);     // Erlaubt das Klicken auf Projekt-Header (Variante 1)
  public onlyProjects = input<boolean>(false);         // Blendet Meilensteine komplett aus (Variante 3)
  public filterByActiveProject = input<boolean>(true); // (Optional) falls du nach einem aktiven Projekt filtern willst

  public initialMilestoneId = input<string | null>(null);
  public initialProjectId = input<string | null>(null);
  public appearance = input<'dropdown' | 'modal'>('dropdown');

  public milestoneSelected = output<string>();
  public projectSelected = output<string>();

  public isOpen = signal<boolean>(false);
  public searchQuery = signal<string>("");
  public isClosing = signal<boolean>(false);

  private elementRef = inject(ElementRef);

  // 🔍 DER MAGISCHE FILTER (Berücksichtigt jetzt die 'onlyProjects' Variante)
  public filteredProjectsWithMilestones = computed(() => {
    const allProjects = this.projectService.projectsList();
    const query = this.searchQuery().toLowerCase().trim();

    return allProjects
      .map((project) => {
        // Wenn NUR Projekte gewünscht sind (Variante 3), übergeben wir ein leeres Meilenstein-Array
        if (this.onlyProjects()) {
          const matchesProjectSearch = project.title.toLowerCase().includes(query);
          return matchesProjectSearch ? { ...project, milestones: [] } : null;
        }

        // Standard-Filterung für Meilensteine (Varianten 1 & 2)
        const matchingMilestones = (project.milestones || []).filter((milestone) => {
          const matchesSearch = milestone.title.toLowerCase().includes(query);
          const isNotDone = milestone.status !== 'Erledigt';
          return matchesSearch && isNotDone;
        });

        // Ein Projekt wird angezeigt, wenn der Name matcht ODER es matchende Meilensteine hat
        const matchesProjectSearch = project.title.toLowerCase().includes(query);
        if (matchesProjectSearch || matchingMilestones.length > 0) {
          return {
            ...project,
            milestones: matchingMilestones
          };
        }
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  });

  // 🏁 Welcher Text steht auf dem Auslöser-Button?
  public currentMilestoneTitle = computed(() => {
    const activeProjectId = this.initialProjectId();
    if (activeProjectId) {
      const foundProject = this.projectService.projectsList().find(p => p.id === activeProjectId);
      return foundProject ? `📁 Projekt: ${foundProject.title}` : "Unbekanntes Projekt";
    }

    const selectedMilestoneId = this.initialMilestoneId();
    if (selectedMilestoneId) {
      const milestones = this.projectService.projectsList().flatMap(project => project.milestones || []);
      const foundMilestone = milestones.find((m) => m.id === selectedMilestoneId);
      return foundMilestone ? `🏁 Phase: ${foundMilestone.title}` : "Unbekannte Phase";
    }

    if (this.onlyProjects()) {
      return 'Projekt auswählen... 📁';
    }
    return 'Filter auswählen... 🎪';
  });

  public toggleDropdown(): void {
    if (this.isDisabled()) return;
    if (this.isOpen()) {
      this.closeDropdown();
    } else {
      this.isOpen.set(true);
    }
  }

  public closeDropdown(): void {
    if (this.appearance() === 'modal') {
      this.isClosing.set(true);
      setTimeout(() => {
        this.isOpen.set(false);
        this.isClosing.set(false);
        this.searchQuery.set("");
      }, 250);
    } else {
      this.isOpen.set(false);
      this.searchQuery.set("");
    }
  }

  public onSearch(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchQuery.set(inputElement.value);
  }

  public selectMilestone(milestoneId: string | null): void {
    if (!milestoneId) return;
    this.milestoneSelected.emit(milestoneId);
    this.closeDropdown();
  }

  public selectProject(projectId: string): void {
    if (!projectId || !this.canChooseProject()) return;
    this.projectSelected.emit(projectId);
    this.closeDropdown();
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    if (this.isDisabled() || !this.isOpen()) return;

    // Klicks außerhalb des Selektors schließen das Dropdown (nur im Dropdown-Modus sinnvoll)
    if (this.appearance() === 'dropdown' && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}