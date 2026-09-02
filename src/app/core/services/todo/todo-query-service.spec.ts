import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TodoQueryService } from './todo-query-service';
import { TodoDataManagerService } from './todo-data-manager-service';
import { ProjectService } from '../project/project-service';
import { TeamService } from '../team/team-service';
import { Todo } from '../../models/todo';
import { Project } from '../../models/project';
import { Milestone } from '../../models/milestone';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('TodoQueryService (Vitest)', () => {
  let service: TodoQueryService;

  // Unsere steuerbaren Mocks
  let todoDataManagerMock: any;
  let projectServiceMock: any;
  let teamServiceMock: any;

  // Signals für die Mocks
  let allTodosPoolMock = signal<Todo[]>([]);
  let projectsListMock = signal<any[]>([]);

  // 🏭 Helper für Valide Test-Projekte
  const createTestProject = (overrides: Partial<ConstructorParameters<typeof Project>[0]> = {}): Project => {
    return new Project({
      ideaId: 'idea123',
      title: 'test-project',
      userId: 'user-123',
      departmentId: 'dep-it-01',
      area: 'IT',
      scope: 'DEPARTMENT',
      milestones: [],
      ...overrides
    });
  };

  beforeEach(() => {
    todoDataManagerMock = {
      allTodosPool: allTodosPoolMock
    };

    projectServiceMock = {
      projectsList: projectsListMock
    };

    teamServiceMock = {
      hasPermission: vi.fn().mockReturnValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        TodoQueryService,
        { provide: TodoDataManagerService, useValue: todoDataManagerMock },
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: TeamService, useValue: teamServiceMock }
      ]
    });

    service = TestBed.inject(TodoQueryService);

    allTodosPoolMock.set([]);
    projectsListMock.set([]);
  });

  it('sollte ein leeres Array liefern, wenn projectId null ist', () => {
    const result = service.getTodosForProject(null);
    expect(result).toEqual([]);
  });

  it('sollte nur Todos zurückgeben, deren Meilenstein zum Projekt gehört', () => {
    const milestone = new Milestone({
      title: "test milestone",
      duration: 1,
      id: "test-milestone"
    });

    const project = createTestProject({
      milestones: [milestone]
    });

    projectsListMock.update(value => [...value, project]);

    const todoWithoutMilestone = new Todo({
      task: "todo without milestone",
    });

    const todoWithWrongMilestone = new Todo({
      task: "wrong milestone",
      milestoneId: "wrong-milestone"
    });

    const todoWithTestMilestone = new Todo({
      task: "correct milestone todo",
      milestoneId: "test-milestone"
    });

    allTodosPoolMock.set([todoWithoutMilestone, todoWithWrongMilestone, todoWithTestMilestone]);

    expect(service.getTodosForProject(project.id)).toEqual([todoWithTestMilestone]);
  });

  it('sollte die korrekte Projekt-ID anhand der Milestone-ID finden', () => {
    const testMilestone = new Milestone({
      title: "test milestone",
      duration: 1,
      id: "test-milestone"
    });

    const testProject = createTestProject({
      id: "proj-valid",
      milestones: [testMilestone]
    });

    const wrongMilestone = new Milestone({
      title: "wrong milestone",
      duration: 1,
      id: "wrong-milestone"
    });

    const wrongProject = createTestProject({
      id: "proj-wrong",
      milestones: [wrongMilestone]
    });

    projectsListMock.set([wrongProject, testProject]);

    expect(service.getProjectIdByMilestoneId(testMilestone.id)).toBe(testProject.id);
  });
});