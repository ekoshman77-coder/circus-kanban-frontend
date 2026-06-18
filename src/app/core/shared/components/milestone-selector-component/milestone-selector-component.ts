import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { ProjectService } from '../../../services/project-service';

@Component({
  selector: 'app-milestone-selector-component',
  imports: [CommonModule],
  templateUrl: './milestone-selector-component.html',
  styleUrl: './milestone-selector-component.css',
})
export class MilestoneSelectorComponent {  
  private projectService = inject(ProjectService);
  public isDisabled = input<boolean>()

  // Wir brauchen die Referenz auf UNSER EIGENES Element im HTML
  private elementRef = inject(ElementRef);
  
  public initialMilestoneId = input<string | null>(null);
  public initialProjectId = input<string | null>(null);
  public canChooseProject = input<boolean>(false);
  // Wenn true: Altes Verhalten (schneidet andere Projekte weg)
  // Wenn false: Neues Verhalten (zeigt alles an, hebt es nur optisch hervor)
  public filterByActiveProject = input<boolean>(true);
  public appearance = input<'dropdown' | 'modal'>('dropdown');

  public milestoneSelected = output<string>();
  public projectSelected = output<string>();
  
  public isOpen = signal<boolean>(false);
  public searchQuery = signal<string>("");
  public isClosing = signal<boolean>(false);

  //DER UNFEHLBARE SCHLIESSER: Fängt JEDEN Klick auf dem Bildschirm ab
  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    if (this.isDisabled()) {
      return
    }

    // Wenn das Popup offen ist...
    if (this.isOpen()) {
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      
      // ...und der Klick NICHT innerhalb unserer Komponente war -> ZUMACHEN!
      if (!clickedInside) {
        this.isOpen.set(false);
      }
    }
  }
  
  public onSearch(event: Event): void {
    if (this.isDisabled()) {
      return
    }
    const inputElement = event.target as HTMLInputElement;
    this.searchQuery.set(inputElement.value);
  }

  public toggleDropdown(): void {
    if (this.isDisabled()) {
      this.closeDropdown()
      return
    }
     this.isOpen.update(value => !value )
  }

public closeDropdown(): void {
    // 1. Wir sagen dem CSS: Start-Schließanimation!
    this.isClosing.set(true);
    
    // 2. Wir warten 200ms, bis die Animation fertig ist, und machen DANN erst ganz zu
    setTimeout(() => {
      this.isOpen.set(false);
      this.isClosing.set(false); // Zurücksetzen für das nächste Mal
    }, 200);
  }
  
  public onInputBlur(): void {
  // ⏱️ Wir warten 150ms, damit ein eventueller Mausklick auf einen Meilenstein-Eintrag 
  // zuerst verarbeitet werden kann, bevor das Fenster zuschnappt!
  setTimeout(() => {
    this.closeDropdown();
  }, 150);
}

  // 🧮 Unser reaktiver Daten-Filter
public filteredProjectsWithMilestones = computed(() => {
    const allProjects = this.projectService.projectsList();
    const query = this.searchQuery().toLowerCase().trim();
    const activeProjectId = this.initialProjectId();

    return allProjects
      .filter(project => {
        // 🌟 Wenn der Filter-Modus AKTIV ist, schneiden wir andere Projekte weg
        if (this.filterByActiveProject() && activeProjectId) {
          return project.id === activeProjectId;
        }
        // Wenn der Filter-Modus DEAKTIVIERT ist, lassen wir alle Projekte durch!
        return true;
      })
      .map(project => {
        const matchingMilestones = project.milestones.filter(milestone => {
          const matchesSearch = milestone.title.toLowerCase().includes(query);
          const isNotDone = milestone.status !== 'Erledigt'; 
          
          return matchesSearch && isNotDone;
        });

        return {
          ...project,
          milestones: matchingMilestones
        };
      })
      .filter(project => project.milestones.length > 0);
  });

  // 🏁 Welcher Titel soll auf dem Button stehen?: select
  public currentMilestoneTitle = computed(() => {
    // 1. Zuerst prüfen: Hat das Board uns eine Projekt-ID übergeben?
    const activeProjectId = this.initialProjectId();
    if (activeProjectId) {
      const foundProject = this.projectService.projectsList().find(p => p.id === activeProjectId);
      return foundProject ? `📁 Projekt: ${foundProject.title}` : "Unbekanntes Projekt";
    }

    // 2. Wenn keine Projekt-ID da ist, greift deine alte Meilenstein-Suche
    const selectedMilestoneId = this.initialMilestoneId();
    if (!selectedMilestoneId) return 'Kein Filter aktiv 🎪';
    
    const milestones = this.projectService.projectsList().flatMap(project => project.milestones);
    const foundMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId);
    
    return foundMilestone ? `🏁 Phase: ${foundMilestone.title}` : "Unbekannter Meilenstein";
  });
  
  public selectMilestone(milestoneId: string | null) {
    if (!milestoneId) {
      return
    }
    this.milestoneSelected.emit(milestoneId);
    this.toggleDropdown()
  }

  public selectProject(projectId: string) {
    if (!projectId) {
      return
    }
    this.projectSelected.emit(projectId)
    this.toggleDropdown()
  } 
  
}


