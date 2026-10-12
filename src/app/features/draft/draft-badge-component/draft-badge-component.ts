import { Component, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraftUIService } from '../draft-ui-service';
import { AppStateService } from '../../../core/services/app-state/app-state-service';

@Component({
  selector: 'app-draft-badge-component',
  imports: [CommonModule],
  templateUrl: './draft-badge-component.html',
  styleUrl: './draft-badge-component.css',
})
export class DraftBadgeComponent {
  private draftUIService = inject(DraftUIService)
  private appStateService = inject(AppStateService)

  public draftIsOpen = this.draftUIService.isDraftBoxOpen

  public chainsCount = this.draftUIService.chainsCount

  public showMe = this.draftUIService.showDraftHandle

  public isLaborMode = this.appStateService.isLaborMode

  public toggleDraft() {
    this.draftUIService.toggleDraftBox()
  }
}
