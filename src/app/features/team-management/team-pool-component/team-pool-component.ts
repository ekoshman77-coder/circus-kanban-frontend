import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
// 📝 NEU: ReactiveFormsModule für Model-Driven Forms, Validators für die Überprüfung
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { TeamService } from '../../../core/services/team-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { UserModel } from '../../../core/models/user-model';
import { UserService } from '../../../core/services/user/user-service';
import { debounceTime, distinct, distinctUntilChanged, filter, map, of, Subject, switchMap, throttleTime } from 'rxjs';

@Component({
  selector: 'app-team-pool',
  standalone: true,
  // 📝 NEU: Wir importieren ReactiveFormsModule statt FormsModule!
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './team-pool-component.html',
  styleUrl: './team-pool-component.css'
})
export class TeamPoolComponent {
  private teamService = inject(TeamService);

  // 1. Das Suchfeld bleibt ein einfaches Signal, das ist perfekt für die Live-Suche
  public searchInput = signal('');
  public errorFromServer = signal<string>("");

  // 2. Der Popup-Zustand für das fliegende Fenster
  public selectedUserForEdit = signal<UserModel | null>(null);

  // 3. Die Datenquelle vom Server (globale User)
  private allUsersServerSignal = toSignal(this.teamService.getSortedByLastName$(null), { initialValue: [] });
  private registerClicks$ = new Subject<void>();

  // 4. LERNPUNKT: Model-Driven Form (Das Formular-Modell im TypeScript)
  public userForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  // 5. LERNPUNKT: Das Formular für das Editier-Popup (ebenfalls modellgetrieben!)
  public editForm = new FormGroup({
    id: new FormControl('', { nonNullable: true }),
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  // 6. LERNPUNKT: Validierung & Datenüberwachung ("Formulare auf Änderungen überwachen")
  // Wir prüfen live, ob der eingegebene Username im Formular schon existiert
  public isUsernameTaken = computed(() => {
    const typedUsername = this.userForm.value.username?.trim().toLowerCase() || '';
    if (!typedUsername) return false;

    return this.allUsersServerSignal().some(user => user.username.toLowerCase() === typedUsername);
  });

  public filteredUsers = toSignal(
    toObservable(this.searchInput).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(input => {
        const users = this.allUsersServerSignal()
        if (!input) {
          return of(users)
        }
        const inputLower = input.toLowerCase()
        const filtered = this.allUsersServerSignal().filter((user) => {
          const userModel = user as UserModel
          if (
            userModel.firstName.toLowerCase().includes(inputLower) ||
            userModel.lastName.toLowerCase().includes(inputLower) ||
            userModel.username.toLowerCase().includes(inputLower)
          ) {
            return true
          }
          if (userModel.getInitials().toLowerCase().includes(inputLower)) {
            return true
          }
          return false
        });
        return of(filtered)
      }),


      map(users => {
        return users.map(user => {
          const UserUpper = new UserModel({
            firstName: user.firstName.toUpperCase(),
            lastName: user.lastName.toUpperCase(),
            username: user.username,
            id: user.id,
            projectIds: user.projectIds
          })
          return UserUpper
        })
      })
    ), { initialValue: [] }
  )

  constructor() {
    this.registerClicks$.pipe(
      throttleTime(2000)
    ).subscribe({
      next: () => {
         this.addUser()
      },
      error: (err) => {
         console.log("error bei Erstellen Userdaten", err)
      }
    } 
    )
  }

  private addUser() {
        console.log("onAdd: start")
    if (this.userForm.invalid || this.isUsernameTaken()) {
      return;
    }

    console.log("onAdd: ask formValues")
    const formValues = this.userForm.getRawValue();
    console.log("onAdd: formValues ", formValues)

    const newUser = new UserModel({
      id: '', // Das Modell triggert im Konstruktor jetzt deine generateLocalId()!
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      username: formValues.username.trim(),
      projectIds: []
    });

    console.log("onAdd: new User: ", newUser)

    this.teamService.createMember(newUser, (err) => this.onError(err));

    // Formular komplett leeren und in den Urzustand zurückversetzen
    this.userForm.reset();
  }

  // ⌨️ 8. LERNPUNKT: HostListener für globale Tastatur-Events (Escape-Taste)
  @HostListener('window:keydown.escape', ['$event'])
  public onKeyDown(event: any): void {
    if (this.selectedUserForEdit()) {
      console.log('⌨️ Escape gedrückt – Popup schließt sich!');
      this.onClosePopup();
    }
  }

  /**
   * User hinzufügen über das reaktive Formular-Modell
   */
  public onAddUser(): void {
     this.registerClicks$.next()
  }

  /**
   * 🗑️ 10. User löschen
   */
  public onDeleteUser(id: string): void {
    if (confirm('Möchtest du diesen Benutzer wirklich löschen?')) {
      this.teamService.deleteMember(null, id);
    }
  }

  /**
   * 🪟 11. POPUP ÖFFNEN und das Editier-Formular mit den Werten befüllen
   */
  public onOpenEditPopup(user: UserModel): void {
    this.selectedUserForEdit.set(user);

    // Wir befüllen das Editier-Formular im Code mit den Daten des ausgewählten Users!
    this.editForm.setValue({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username
    });
  }

  /**
   * 💾 12. POPUP SPEICHERN
   */
  public onSaveEdit(): void {
    if (this.editForm.invalid) return;

    const formValues = this.editForm.getRawValue();

    // Wir bauen das aktualisierte Modell zusammen
    const updatedUser = new UserModel({
      id: formValues.id,
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      username: formValues.username.trim(),
      projectIds: this.selectedUserForEdit()?.projectIds || []
    });

    this.teamService.updateMember(updatedUser);
    this.selectedUserForEdit.set(null); // Popup zu
  }

  public onClosePopup(): void {
    this.selectedUserForEdit.set(null);
  }

  public onError(error: string) {
    this.errorFromServer.set(error)
  }

  public closeError() {
    this.errorFromServer.set("")
  }
}