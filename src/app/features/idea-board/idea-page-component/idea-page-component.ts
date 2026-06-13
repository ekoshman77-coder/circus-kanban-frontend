import { Component, inject } from '@angular/core';
import { IdeaBoardComponent } from '../idea-board-component/idea-board-component';
import { ProjectCalculatorComponent } from '../project-calculator-component/project-calculator-component';
import { ProjectsComponent } from '../projects-component/projects-component';
import { BoardTab, TabNavigationService } from '../tab-navigation-service'; // 🌟 Importieren
import { ProjectMilestonesComponent } from '../project-milestones-component/project-milestones-component';
import { TeamBoardComponent } from '../team-board-component/team-board-component';


@Component({
  selector: 'app-idea-page-component',
  standalone: true, // Sichergestellt für modernen Angular-Datenfluss
  imports: [IdeaBoardComponent, ProjectCalculatorComponent, ProjectsComponent, ProjectMilestonesComponent, TeamBoardComponent],
  templateUrl: './idea-page-component.html',
  styleUrl: './idea-page-component.css',
})
export class IdeaPageComponent {
  public tabService = inject(TabNavigationService);

  public readonly IdeaTabType = BoardTab;

  /**
   * 🌟 REAKTIVE BRÜCKE:
   * Statt eines eigenen Signals lesen wir JETZT live aus dem TabNavigationService!
   * Das sorgt dafür, dass das HTML sofort mitspringt, wenn das Board umschaltet.
   */
  public activeTab = this.tabService.activeTab;

  // Wenn der Benutzer manuell auf die Nav-Buttons klickt, steuern wir den Service an
  public setTab(tabName: BoardTab): void {
    this.tabService.changeTab(tabName, null);
  }
}