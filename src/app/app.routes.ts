import { Routes } from '@angular/router';
import { WelcomeComponent } from './features/welcome/welcome-component/welcome-component';
import { TodoPageComponent } from './features/todo/todo-page-component/todo-page-component';
import { StatisticBoardComponent } from './features/statistic-board/statistic-board-component/statistic-board-component';
import { PlannerComponent } from './features/planner/planner-component/planner-component'; // Pfad prüfen!
import { authGuard } from './core/guards/auth-guard';
import { FocusTimerComponent } from './features/focus-timer/focus-timer-component/focus-timer-component';
import { QuickActionCenterComponent } from './features/quick-todo/quick-action-center-component/quick-action-center-component';
import { PlannerBoardComponent } from './features/planner/planner-board-component/planner-board-component';
import { onlineGuard } from './core/guards/online-guard';
import { IdeaBoardComponent } from './features/idea-board/idea-board-component/idea-board-component';
import { IdeaPageComponent } from './features/idea-board/idea-page-component/idea-page-component';
import { ProjectCalculatorComponent } from './features/idea-board/project-calculator-component/project-calculator-component';
import { TeamManagementComponent } from './features/team-management/team-management-component/team-management-component';

export const routes: Routes = [
    { 
      path: "", 
      component: WelcomeComponent 
    },
    { 
      path: "todopage", 
      component: TodoPageComponent,
      canActivate: [authGuard]
    },
    { 
      path: "statistics", 
      component: StatisticBoardComponent,
      canActivate: [authGuard]
    },
    { 
      path: "planner", 
      component: PlannerBoardComponent,
      canActivate: [authGuard]
    },
    { 
      path: "focus", 
      component: FocusTimerComponent,
      canActivate: [authGuard, onlineGuard]
    },
    { 
      path: "quick-center", 
      component: QuickActionCenterComponent,
      canActivate: [authGuard]
    }, 
    { 
      path: "todopage/edit/:id", 
      loadComponent: () => import('./features/todo/todo-edit-component/todo-edit-component').then(m => m.TodoEditComponent),
      canActivate: [authGuard]
    },
    { 
      path: "ideas", 
      component: IdeaPageComponent,
      canActivate: [authGuard]
    },
    { 
      path: "calculator", 
      component: ProjectCalculatorComponent,
      canActivate: [authGuard]
    },
    { 
      path: "team", 
      component: TeamManagementComponent,
      canActivate: [authGuard]
    }

];