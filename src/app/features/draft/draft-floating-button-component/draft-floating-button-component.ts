import { Component, computed, HostListener, model, signal } from '@angular/core';
import { inject } from '@angular/core';
import { DraftUIService } from '../draft-ui-service';

@Component({
  selector: 'app-draft-floating-button-component',
  imports: [],
  templateUrl: './draft-floating-button-component.html',
  styleUrl: './draft-floating-button-component.css',
})
export class DraftFloatingButtonComponent {
  private draftUIService = inject(DraftUIService)
  
  public isDraftOpen = this.draftUIService.isDraftBoxOpen
  public isScrolledDown = signal<boolean>(false)

  public count = this.draftUIService.chainsCount
  public showMe = computed(() => this.draftUIService.showDraftHandle() && this.isScrolledDown())

  @HostListener('window:scroll', [])
    onWindowScroll(): void {
    this.isScrolledDown.set(window.scrollY > 36);
  }

  public toggleDraft() {
    this.draftUIService.toggleDraftBox()
  }
}
