import { Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-role-selection-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selection-modal.html',
  styleUrl: './role-selection-modal.css'
})
export class RoleSelectionModalComponent {
  // 🔄 TWO-WAY SIGNAL: Kann von Kind AND Eltern verändert werden!
  public isOpen = model<boolean>(false);

  // 📥 READ-ONLY INPUTS
  public title = input<string>('Rolle zuweisen');
  public message = input<string>('Bitte wähle eine Rolle aus:');
  public options = input<string[]>([]); // Strings aus MasterData

  // 📤 OUTPUTS
  public confirmed = output<string>();
  public cancelled = output<void>();

  // ⚡ Schließt sich selbst per isOpen.set(false) & emittet Event
  public selectRole(role: string, event: MouseEvent): void {
    event.stopPropagation(); // 👈 Verhindert, dass der Klick ans Overlay weitergeleitet wird!
    console.log('1️⃣ [MODAL] Rolle angeklickt:', role);
    this.isOpen.set(false);
    this.confirmed.emit(role);
  }

  public onCancel(): void {
    console.log('❌ [MODAL] Abgebrochen / Overlay Klick');
    this.isOpen.set(false);
    this.cancelled.emit();
  }

  public onOverlayClick(event: MouseEvent): void {
    console.log('❌ [MODAL] Overlay Klick');
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}