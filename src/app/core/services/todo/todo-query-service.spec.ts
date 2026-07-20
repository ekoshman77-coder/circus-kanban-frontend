import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TodoQueryService } from './todo-query-service';
import { TodoDataManagerService } from './todo-data-manager-service';
import { ProjectService } from '../project/project-service';
import { TeamService } from '../team/team-service';
import { Todo } from '../../models/todo';
import { Project } from '../../models/project';
import { Milestone } from '../../models/milestone';
import { N } from '@angular/cdk/keycodes';

describe('TodoQueryService (Vitest)', () => {
  let service: TodoQueryService;

  // Unsere steuerbaren Mocks
  let todoDataManagerMock: any;
  let projectServiceMock: any;
  let teamServiceMock: any;

  // Signals für die Mocks
  let allTodosPoolMock = signal<Todo[]>([]);
  let projectsListMock = signal<any[]>([]);

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

    // Vor jedem Test leer machen
    allTodosPoolMock.set([]);
    projectsListMock.set([]);
  });

  // --- HIER STARTEN UNSERE TRAININGS-TESTS ---

  it('sollte ein leeres Array liefern, wenn projectId null ist', () => {
    const result = service.getTodosForProject(null);
    expect(result).toEqual([]);
  });

  it('sollte nur Todos zurückgeben, deren Meilenstein zum Projekt gehört', () => {
    const milestone = new Milestone({
        title: "test milestone",
        duration: 1,
        id: "test-milestone"
    })

    const project = new Project({
        ideaId: "idea123",
        title: "test-project",
        userId: "user-123",
        area: "",
        milestones: [milestone]
    })

    projectsListMock.update(value => [...value, project])
    
    const todoWithoutMilestone = new Todo({
        task: "todo without milestone",        
    })

    const todoWithWrongMilestone = new Todo({
        task: "wrong milestone",
        milestoneId: "wrong-milestone" 
    })
        
    const todoWithTestMilestone = new Todo({
        task: "wrong milestone",
        milestoneId: "test-milestone" 
    })

    allTodosPoolMock.set([todoWithoutMilestone, todoWithWrongMilestone, todoWithTestMilestone])
    
    expect(service.getTodosForProject(project.id)).toEqual([todoWithTestMilestone])
    
});

  it('sollte die korrekte Projekt-ID anhand der Milestone-ID finden', () => {
    const testMilestone = new Milestone({
        title: "test milestone",
        duration: 1,
        id: "test-milestone"
    })

    const testProject = new Project({
        ideaId: "idea123",
        title: "test-project",
        userId: "user-123",
        area: "",
        milestones: [testMilestone]
    })

    const wrongMilestone = new Milestone({
        title: "test milestone",
        duration: 1,
        id: "wrong-milestone"
    })

    const wrongProject = new Project({
        ideaId: "idea1234",
        title: "wrong-project",
        userId: "user-123",
        area: "",
        milestones: [wrongMilestone]
    })

    projectsListMock.set([wrongProject, testProject])

    expect(service.getProjectIdByMilestoneId(testMilestone.id)).toBe(testProject.id)    
  });

  it('sollte true zurückgeben, wenn milestoneId null ist (privates Todo)', () => {
    const hasPerm = service.hasPermissionForMilestone(null, 'TODO_CREATE');
    expect(hasPerm).toBe(true);
  });

  it('sollte result von teamSetrvice zurückgeben, wenn milestoneId not null ist ', () => {
        const testMilestone = new Milestone({
        title: "test milestone",
        duration: 1,
        id: "test-milestone"
    })

    const testProject = new Project({
        ideaId: "idea123",
        title: "test-project",
        userId: "user-123",
        area: "",
        milestones: [testMilestone]
    })

    projectsListMock.set([testProject])

    const hasPerm = service.hasPermissionForMilestone(testMilestone.id, 'TODO_CREATE');
    expect(hasPerm).toBe(true);
 
    teamServiceMock.hasPermission.mockReturnValueOnce(false)
    expect(service.hasPermissionForMilestone(testMilestone.id, 'TODO_CREATE')).toBe(false)

    expect(teamServiceMock.hasPermission).toHaveBeenNthCalledWith(2, testProject.id, 'TODO_CREATE')

  });

});