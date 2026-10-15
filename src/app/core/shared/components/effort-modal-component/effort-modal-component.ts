import { Component, input, output, inject, OnInit, OnDestroy, TemplateRef, ViewChild, ViewContainerRef, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { TodoViewModel } from '../../../viewmodel/todo-view-model';

@Component({
  selector: 'app-effort-modal-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './effort-modal-component.html',
  styleUrl: './effort-modal-component.css',
})
export class EffortModalComponent implements OnInit, OnDestroy {
  vm = input.required<TodoViewModel>();
  
  // 🎯 NEU: Referenz auf die Todo-Karte als Ankerpunkt
  origin = input.required<ElementRef>();

  confirm = output<{ devEffort: number; reviewerEffort: number }>();
  cancel = output<void>();

  @ViewChild('popoverTemplate', { static: true }) popoverTemplate!: TemplateRef<unknown>;

  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private overlayRef?: OverlayRef;

  ngOnInit(): void {
    // 🎯 Positions-Strategie: Popover dockt oben/unten an die Karte an
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.origin())
      .withPositions([
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 8 // Kleiner Abstand unter der Karte
        },
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -8 // Fallback nach oben, falls unten kein Platz im Bildschirm ist
        }
      ]);

    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition() // Wandert beim Scrollen mit
    });

    this.overlayRef.backdropClick().subscribe(() => this.cancel.emit());

    const portal = new TemplatePortal(this.popoverTemplate, this.viewContainerRef);
    this.overlayRef.attach(portal);
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  onConfirm(): void {
    this.confirm.emit({
      devEffort: this.vm().popupEffortValue(),
      reviewerEffort: this.vm().popupReviewerEffortValue()
    });
  }
}