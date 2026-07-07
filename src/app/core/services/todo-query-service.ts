import { inject, Injectable } from '@angular/core';
import { TodoDataManagerService } from './todo-data-manager-service';
import { ProjectService } from './project-service';
import { TeamService } from './team-service';
import { Todo } from '../models/todo';
import { ProjectAction } from '../enums/project-action-enum'; // Passe das an dein echtes Enum/Typ an

@Injectable({
  providedIn: 'root'
})
export class TodoQueryService {
  // 🛡️ DIE SENSATION: Kein inject(TodoService) mehr! Der Kreis ist endgültig gesprengt.
  private todoDataManager = inject(TodoDataManagerService);
  private projectService = inject(ProjectService);
  private teamService = inject(TeamService);

  /**
   * 🎯 Holt alle Todos für ein bestimmtes Projekt (für dein Projekt-Board)
   */
  public getTodosForProject(projectId: string | null): Todo[] {
    if (!projectId) return [];
    
    // 🌍 Wir lesen den Pool direkt aus dem DataManager!
    const allTodos = this.todoDataManager.allTodosPool(); 
    const project = this.projectService.projectsList().find(p => p.id === projectId);
    
    if (!project || !project.milestones) return [];

    const milestoneIds = project.milestones.map(m => m.id);
    return allTodos.filter(todo => todo.milestoneId && milestoneIds.includes(todo.milestoneId));
  }

  /**
   * 🔍 Findet die passende Project-ID anhand einer Milestone-ID
   */
  public getProjectIdByMilestoneId(milestoneId: string | null): string | null {
    if (!milestoneId) return null;

    // Durchsucht den Projekt-Pool im ProjectService nach dem Meilenstein
    const foundProject = this.projectService.projectsList().find(p => 
      p.milestones?.some(m => m.id === milestoneId)
    );

    return foundProject ? foundProject.id : null;
  }

  /**
   * 👑 Die Weiche für die Todo-Rechte: Löst Milestone auf und fragt den TeamService
   */
  public hasPermissionForMilestone(milestoneId: string | null, action: ProjectAction): boolean {
    if (!milestoneId) return true; // Privates Todo -> Der Besitzer darf immer alles!

    // 1. Projekt-ID ermitteln
    const projectId = this.getProjectIdByMilestoneId(milestoneId);
    
    // 2. Pure Rechteprüfung an den TeamService delegieren
    return this.teamService.hasPermission(projectId, action);
  }
}