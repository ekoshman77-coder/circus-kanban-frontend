import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminProjectBoardComponent } from './admin-project-board-component';
import { AdminProjectService } from '../../../../core/services/admin/projects/admin-project-service';
import { DepartmentService } from '../../../../core/services/admin/department-service';

describe('AdminProjectBoardComponent', () => {
  let component: AdminProjectBoardComponent;
  let fixture: ComponentFixture<AdminProjectBoardComponent>;

  // 🎯 Exakte Mocks, die alle Aufrufe aus dem HTML-Template abdecken
  const adminProjectServiceMock = {
    selectedDepartmentId: signal('ALL'),
    projectStats: signal({ totalActive: 0, totalZipped: 0 }),
    activeProjects: signal([]),
    zippedProjects: signal([]),
    toggleProjectZipStatus: vi.fn(),
    updateProjectStatus: vi.fn(),
  };

  const departmentServiceMock = {
    departments: signal([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProjectBoardComponent],
      providers: [
        { provide: AdminProjectService, useValue: adminProjectServiceMock },
        { provide: DepartmentService, useValue: departmentServiceMock },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProjectBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});