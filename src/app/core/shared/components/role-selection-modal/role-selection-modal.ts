import { Component, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserModel } from '../../../models/user-model';

export interface RoleApprovalResult {
  role: string;
  supervisorId?: string | null;
}

@Component({
  selector: 'app-role-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-selection-modal.html',
  styleUrl: './role-selection-modal.css'
})
export class RoleSelectionModalComponent {
  // 🔄 TWO-WAY SIGNAL
  public isOpen = model<boolean>(false);

  // 📥 READ-ONLY INPUTS
  public title = input<string>('Rolle zuweisen');
  public message = input<string>('Bitte wähle eine Rolle aus:');
  public options = input<string[]>([]); // Strings aus MasterData
  public supervisors = input<UserModel[]>([]); // Verfügbare Betreuer aus der Abteilung

  // 📤 OUTPUTS
  public confirmed = output<RoleApprovalResult>(); // Sendet nun Rolle + supervisorId
  public cancelled = output<void>();

  // 🔮 INTERNER STATE
  public selectedRole = signal<string | null>(null);
  public selectedSupervisorId = signal<string | null>(null);

  /** Prüft, ob es sich um eine isolierte Labor-Rolle handelt */
  public isLaborRole(role: string | null): boolean {
    if (!role) return false;
    const normalized = role.toUpperCase();
    return normalized === 'INTERN' || normalized === 'PRAKTIKANT' || normalized === 'GUEST' || normalized === 'GAST';
  }

  public selectRole(role: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedRole.set(role);

    // 🚀 Wenn es EINE NORMALE Rolle ist, sofort wie bisher bestätigen!
    if (!this.isLaborRole(role)) {
      this.confirmSelection();
    }
  }

  public confirmSelection(): void {
    const role = this.selectedRole();
    if (!role) return;

    const result: RoleApprovalResult = {
      role: role,
      supervisorId: this.isLaborRole(role) ? this.selectedSupervisorId() : null
    };

    console.log('1️⃣ [MODAL] Rolle & Supervisor bestätigt:', result);
    this.isOpen.set(false);
    this.confirmed.emit(result);
    this.resetInternalState();
  }

  public onCancel(): void {
    console.log('❌ [MODAL] Abgebrochen');
    this.isOpen.set(false);
    this.cancelled.emit();
    this.resetInternalState();
  }

  public onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  private resetInternalState(): void {
    this.selectedRole.set(null);
    this.selectedSupervisorId.set(null);
  }
}