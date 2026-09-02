import { Component, computed, effect, inject, input, output, signal, OnInit } from '@angular/core';
import { DepartmentService } from '../../../services/admin/department-service';
import { Note } from '../../../models/note';
import { TeamService } from '../../../services/team/team-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CreateProjectPayload {
  ideaId: string;
  projectManagerId: string;
  title: string;
}

@Component({
  selector: 'app-assign-project-manager-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assigment-project-manager-modal.html',
  styleUrl: './assigment-project-manager-modal.css',
})
export class AssignProjectManagerModalComponent implements OnInit {
  private teamService = inject(TeamService);
  private departmentService = inject(DepartmentService);

  /** 🟢 Die übergebene Idee */
  public note = input.required<Note>();

  /** 🟢 Outputs für Abbrechen und Speichern */
  public cancel = output<void>();
  public confirm = output<CreateProjectPayload>();

  /** Formular-Zustände */
  public selectedPmId = signal<string>('');
  public projectTitle = signal<string>('');
  
  /** 🏢 Die aktuell im Filter gewählte Abteilungs-ID ('ALL' = alle Abteilungen) */
  public selectedDepartmentId = signal<string>('ALL');

  /** 🏢 Liste aller verfügbaren Abteilungen aus dem DepartmentService */
  public departments = computed(() => this.departmentService.departments());

  /** 👥 Dynamisch gefilterte Liste von Personen je nach ausgewählter Abteilung */
  public filteredMembers = computed(() => {
    const allMembers = this.teamService.globalMembersSignal();
    const targetDeptId = this.selectedDepartmentId();
  
    if (!targetDeptId || targetDeptId === 'ALL') {
      return allMembers;
    }

    return allMembers.filter(member => member.user.department?.id === targetDeptId);
  });

  ngOnInit(): void {
    // 1. Sicherstellen, dass die globale User-Liste geladen ist
    this.teamService.loadGlobalPool();
    // 2. Abteilungen laden
    this.departmentService.loadDepartments();
  }

  constructor() {
    // Vorbelegung von Titel und Abteilungs-Filter basierend auf der Herkunfts-Idee
    effect(() => {
      const idea = this.note();
      if (idea) {
        this.projectTitle.set(`Projekt: ${idea.title}`);
        
        // Default-Filter auf die Herkunftsabteilung der Idee setzen (falls vorhanden)
        if (idea.departmentId) {
          this.selectedDepartmentId.set(idea.departmentId);
        } else {
          this.selectedDepartmentId.set('ALL');
        }
      }
    });
  }

  public onDepartmentChange(deptId: string): void {
    this.selectedDepartmentId.set(deptId);
    // Bei Abteilungswechsel die vorherige PM-Auswahl zurücksetzen
    this.selectedPmId.set('');
  }

  public onChange(userId: string): void {
    this.selectedPmId.set(userId);
  }

  public onSubmit(): void {
    if (!this.selectedPmId() || !this.projectTitle().trim()) return;

    this.confirm.emit({
      ideaId: this.note().id!,
      projectManagerId: this.selectedPmId(),
      title: this.projectTitle().trim()
    });
  }

  public onCancel(): void {
    this.cancel.emit();
  }
}