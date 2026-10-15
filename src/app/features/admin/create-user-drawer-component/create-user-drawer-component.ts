import { Component, effect, ElementRef, HostListener, inject, input, model, output, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TeamService } from '../../../core/services/team/team-service';
import { UserModel } from '../../../core/models/user-model';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs';
import { NotificationService } from '../../../core/services/notification/notification-service';

@Component({
  selector: 'app-create-user-drawer-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-user-drawer-component.html',
  styleUrl: './create-user-drawer-component.css',
})
export class CreateUserDrawerComponent {
  private builder = inject(FormBuilder);
  private teamService = inject(TeamService);
  private notificationService = inject(NotificationService)

  // 🟢 Input vom Parent + Output zur Synchronisation
  public isOpen = model<boolean>(false);
  public isOpenChange = output<boolean>();
  public userCreated = output<void>();

  public errorFromServer = signal<string>('');
  public isSubmitting = signal(false);

  public userForm = this.builder.nonNullable.group({
    username: ["", [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    firstName: ["", Validators.required],
    lastName: ['', Validators.required],
  });

  @ViewChild('firstNameInput') firstNameInput?: ElementRef<HTMLInputElement>;
 
  constructor() {
    // 2. Sobald `isOpen()` auf true springt, wartet Angular kurz die Animation ab & fokussiert!
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => {
          this.firstNameInput?.nativeElement?.focus();
        }, 150); // 150ms reicht perfekt für die Slide-In Animation
      }
    });
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    // Schließt den Drawer nur, wenn er auch wirklich offen ist!
    if (this.isOpen()) {
      this.closeDrawer();
    }
  }
  
  public toggleDrawer(): void {
    console.log('🚪 Griff geklickt! Alter Status:', this.isOpen());
    this.isOpen.update(val => !val);
  }

  public closeDrawer(): void {
    console.log("closeDrawer")
    this.isOpenChange.emit(false);
    this.errorFromServer.set('');
    this.userForm.reset();
    this.isOpen.set(false)
  }

  public onSubmit(): void {
    if (this.userForm.invalid) return;

    this.isSubmitting.set(true);
    const userData = this.userForm.value;
    const newUser = new UserModel({
      id: '',
      firstName: userData.firstName?.trim() ?? "",
      lastName: userData.lastName?.trim() ?? "",
      username: userData.username?.trim().toLowerCase() ?? "",
      isApproved: false,
      department: null,
      projectIds: []
    });

    this.teamService.createMember(newUser, userData.password ?? "", (err) => {
      if (err) {
        this.isSubmitting.set(false);

        // 🟢 Übersetzt den technischen Fehler in sauberen User-Text!
        const friendlyMessage = this.getErrorMessage(err);
        this.errorFromServer.set(friendlyMessage);
        this.notificationService.showNotification(friendlyMessage, 'error')
      } else {
        this.isSubmitting.set(false);
        this.userCreated.emit();
        this.closeDrawer();
      }
    });
  }

  private getErrorMessage(err: any): string {
    // Fall 1: Prüfe den spezifischen BackendErrorCode (falls vorhanden)
    const backendCode = err?.error?.errorCode;

    switch (backendCode) {
      case 'USER_ALREADY_EXISTS':
        return 'Dieser Benutzername ist bereits vergeben. Bitte wähle einen anderen.';
      case 'FORBIDDEN':
        return 'Du hast leider keine Berechtigung, neue Benutzer anzulegen.';
      case 'INVALID_DATA':
        return 'Bitte überprüfe deine Eingaben. Einige Felder sind ungültig.';
    }

    // Fall 2: Fallback über den HTTP-Statuscode
    switch (err?.status) {
      case 409:
        return 'Ein Benutzer mit diesem Namen existiert bereits.';
      case 403:
        return 'Zugriff verweigert. Dir fehlen die erforderlichen Rechte.';
      case 400:
        return 'Ungültige Daten übermittelt. Bitte korrigiere deine Eingaben.';
      case 500:
        return 'Ein Serverfehler ist aufgetreten. Bitte versuche es später erneut.';
      default:
        return 'Ein unerwarteter Fehler ist aufgetreten. Bitte überprüfe deine Verbindung.';
    }
  }
}