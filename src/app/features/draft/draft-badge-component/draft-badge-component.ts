import { Component, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraftUIService } from '../draft-ui-service';

@Component({
  selector: 'app-draft-badge-component',
  imports: [CommonModule],
  templateUrl: './draft-badge-component.html',
  styleUrl: './draft-badge-component.css',
})
export class DraftBadgeComponent {
  private draftUIService = inject(DraftUIService)

  public draftIsOpen = this.draftUIService.isDraftBoxOpen

  public chainsCount = this.draftUIService.chainsCount

  public showMe = this.draftUIService.showDraftHandle

  public toggleDraft() {
    this.draftUIService.toggleDraftBox()
  }
}
