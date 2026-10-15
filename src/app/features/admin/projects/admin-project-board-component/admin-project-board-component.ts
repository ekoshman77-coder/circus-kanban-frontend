import { Component, computed, inject, signal } from '@angular/core';
import { AdminProjectService } from '../../../../core/services/admin/projects/admin-project-service';
import { Project } from '../../../../core/models/project';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ProjectStatus } from '../../../../core/repositories/dto/project-json';
import { DepartmentService } from '../../../../core/services/admin/department-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type ExpandedZone = 'active' | 'zipped';

@Component({
  selector: 'app-admin-project-board-component',
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './admin-project-board-component.html',
  styleUrl: './admin-project-board-component.css',
})
export class AdminProjectBoardComponent {
  protected adminProjectService = inject(AdminProjectService);
  protected departmentService = inject(DepartmentService);

  public expandedZone = signal<ExpandedZone>('active');
  public departments = computed(() => this.departmentService.departments());

  /** 🛡️ Verhindert jeglichen Zonenwechsel während des Draggings */
  public isDragging = signal<boolean>(false);

  public onDragStarted(): void {
    this.isDragging.set(true);
  }

  public onDragEnded(): void {
    this.isDragging.set(false);
  }

  /** 🎯 Schaltet Zonen nur um, wenn aktuell NICHT gezogen wird */
  public setExpandedZone(zone: ExpandedZone): void {
    if (!this.isDragging()) {
      this.expandedZone.set(zone);
    }
  }

  // -------------------------------------------------------------------------
  // 🔄 DRAG & DROP LOGIK
  // -------------------------------------------------------------------------

  public onDropToZip(event: CdkDragDrop<Project[]>): void {
    this.isDragging.set(false);
    const project = event.item.data as Project;
    if (project && project.status !== 'Zip') {
      this.adminProjectService.toggleProjectZipStatus(project.id, true);
    }
  }

  public onDropToActive(event: CdkDragDrop<Project[]>): void {
    this.isDragging.set(false);
    const project = event.item.data as Project;
    if (project && project.status === 'Zip') {
      this.adminProjectService.toggleProjectZipStatus(project.id, false);
    }
  }

  // -------------------------------------------------------------------------
  // 🎨 UI HILFSMETHODEN
  // -------------------------------------------------------------------------

  public getDepartmentInitials(departmentId: string): string {
    const dept = this.departments().find(d => d.id === departmentId);
    return dept ? dept.getInitials() : '??';
  }

  public getDepartmentColor(departmentId: string): string {
    const dept = this.departments().find(d => d.id === departmentId);
    return dept ? dept.getColorHash() : '#cbd5e1';
  }

  public getDepartmentName(departmentId: string): string {
    const dept = this.departments().find(d => d.id === departmentId);
    return dept ? dept.name : 'Allgemein';
  }

  public onStatusChange(project: Project, newStatus: ProjectStatus): void {
    this.adminProjectService.updateProjectStatus(project, newStatus);
  }
}