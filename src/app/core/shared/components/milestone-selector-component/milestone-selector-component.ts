import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, input, output, signal, effect } from '@angular/core';
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
  private elementRef = inject(ElementRef);
  private document = inject(DOCUMENT); // 🌟 Ermöglicht den sicheren Zugriff auf den Body
  
  public isDisabled = input<boolean>(false);
  
  // ⚙️ DIE DREI STEUER-INPUTS FÜR UNSERE VARIANTEN:
  public canChooseProject = input<boolean>(false);     // Erlaubt das Klicken auf Projekt-Header (Variante 1)
  public onlyProjects = input<boolean>(false);         // Blendet Meilensteine komplett aus (Variante 3)
  public filterByActiveProject = input<boolean>(true); // (Optional)

  public initialMilestoneId = input<string | null>(null);
  public initialProjectId = input<string | null>(null);
  public appearance = input<'dropdown' | 'modal'>('dropdown');

  public milestoneSelected = output<string>();
  public projectSelected = output<string>();

  public isOpen = signal<boolean>(false);
  public searchQuery = signal<string>("");
  public isClosing = signal<boolean>(false);

  constructor() {
    // 🌟 DER AUTOMATISCHE BEAMER-EFFEKT:
    // Zwingt das Modal physikalisch in den <body>, damit es niemals überdeckt wird!
    effect(() => {
      const open = this.isOpen();
      const isModal = this.appearance() === 'modal';
      
      if (open && isModal) {
        // Wir warten ganz kurz, bis Angular das HTML gerendert hat...
        setTimeout(() => {
          const backdrop = this.elementRef.nativeElement.querySelector('.modal-backdrop');
          if (backdrop) {
            // 🚀 BEAMEN! Wir hängen den Backdrop direkt an das Ende des <body> an!
            this.document.body.appendChild(backdrop);
          }
        });
      }
    });
  }

  // 🔍 DER MAGISCHE FILTER (Jetzt wieder vollständig repariert!)
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
      
      // Vor dem Schließen räumen wir das Element im Body wieder auf!
      const backdrop = this.document.querySelector('body > .modal-backdrop');
      
      setTimeout(() => {
        if (backdrop) {
          backdrop.remove(); // 🧹 Aus dem Body löschen
        }
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

    // Wenn das Modal im Body gerendert ist, müssen wir prüfen, ob der Klick im Portal gelandet ist
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    const clickedInPortal = this.document.querySelector('body > .modal-backdrop')?.contains(event.target as Node);
    
    if (this.appearance() === 'dropdown' && !clickedInside) {
      this.closeDropdown();
    } else if (this.appearance() === 'modal' && !clickedInside && !clickedInPortal) {
      this.closeDropdown();
    }
  }
}