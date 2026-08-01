import { Component, inject, computed, signal, HostListener, OnInit, OnDestroy } from '@angular/core'; // 🎯 OnDestroy hinzugefügt
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { TeamService } from '../../../core/services/team/team-service';
import { UserModel } from '../../../core/models/user-model';
import { Subject, Subscription, throttleTime } from 'rxjs'; // 🎯 Subscription importieren
import { FilterService } from '../../../core/services/filter/filter-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';

@Component({
  selector: 'app-team-pool',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UniversalPopupComponent],
  templateUrl: './team-pool-component.html',
  styleUrl: './team-pool-component.css'
})
export class TeamPoolComponent implements OnInit, OnDestroy { // 🎯 OnDestroy für sauberes Aufräumen
  private teamService = inject(TeamService);
  private filterService = inject(FilterService);

  // ❌ Lokaler searchInput fliegt raus, da wir filterService nutzen!
  public errorFromServer = signal<string>("");
  public selectedUserForEdit = signal<UserModel | null>(null);

  // 🎯 Signal für das zu löschende Mitglied (hält die ID als String)
  public userToDelete = signal<string | null>(null);

  // 👑 Königslösung: Holt die flachen Benutzer direkt aus dem Service-Signal!
  private allUsersServerSignal = computed(() => {
    return this.teamService.globalMembersSignal().map(member => member.user);
  })

  // 🛡️ Dein Klick-Spam-Schutz bleibt bestehen!
  private registerClicks$ = new Subject<void>();
  private clickSub?: Subscription;

  public userForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl("", { nonNullable: true, validators: [Validators.required] })
  });

  public editForm = new FormGroup({
    id: new FormControl('', { nonNullable: true }),
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true })
  });

  // 🔍 Die Filter-Logik zieht sich den Suchbegriff jetzt direkt aus der globalen Suche!
  public filteredUsers = computed(() => {
    const users = this.allUsersServerSignal();
    const search = this.filterService.searchTerm().toLowerCase().trim();
    const category = this.filterService.currentCategory(); // 🎯 Aktuelle Kategorie aus dem Service

    // 🛡️ Wenn wir in einer ganz anderen Kategorie sind, filtern wir dieses Grid nicht
    if (category !== 'team' && category !== 'all') {
      return users;
    }

    if (!search) return users;

    return users.filter(u =>
      u.firstName.toLowerCase().includes(search) ||
      u.lastName.toLowerCase().includes(search) ||
      u.username.toLowerCase().includes(search)
    );
  });

  public isUsernameTaken = computed(() => {
    const users = this.allUsersServerSignal();
    const typedUsername = this.userForm.get('username')?.value?.trim().toLowerCase();
    if (!typedUsername) return false;
    return users.some(u => u.username.toLowerCase() === typedUsername);
  });

  ngOnInit(): void {
    this.filterService.setInitialCategory('team');

    console.log('👥 [TeamPool] Trigger globalen Pool-Sync im OnInit');
    this.teamService.loadGlobalPool();
    // 🛡️ Wir registrieren das Klick-Abo sauber im ngOnInit, genau wie du es hattest!
    this.clickSub = this.registerClicks$.pipe(
      throttleTime(2000)
    ).subscribe(() => {
      this.executeUserRegistration();
    });
  }

  ngOnDestroy(): void {
    // 🧹 Wichtig: Abo kündigen, wenn die Komponente verlassen wird!
    this.clickSub?.unsubscribe();
  }

  public onAddUser(): void {
    this.registerClicks$.next();
  }

  private executeUserRegistration(): void {
    if (this.userForm.invalid || this.isUsernameTaken()) return;

    const values = this.userForm.getRawValue();
    const newUser = new UserModel({
      id: '',
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      username: values.username.trim().toLowerCase(),
      role: 'Teammitglied',
      emoji: '👤',
      coffeeBalance: 0,
      isApproved: null,
      departmentId: null,
      projectIds: []
    });

    this.teamService.createMember(newUser, values.password, (err) => {
      this.errorFromServer.set(err);
    });

    this.userForm.reset();
  }

  public onDeleteUser(id: string): void {
    this.userToDelete.set(id);
  }

  // 🚀 Das wird aufgerufen, wenn im schicken Popup "Bestätigen" geklickt wird
  public executeDeletion(id: string | null): void {
    if (!id) return;
    this.teamService.deleteMember(null, id);
    this.userToDelete.set(null); // Popup wieder schließen
  }

  // ❌ Abbrechen-Logik
  public cancelDeletion(): void {
    this.userToDelete.set(null); // Popup einfach schließen
  }

  public onOpenEditPopup(user: UserModel): void {
    this.selectedUserForEdit.set(user);
    this.editForm.setValue({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username
    });
  }

  public onSaveEdit(): void {
    if (this.editForm.invalid) return;
    const formValues = this.editForm.getRawValue();
    const currentUser = this.selectedUserForEdit();

    const updatedUser = new UserModel({
      id: formValues.id,
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      username: formValues.username.trim(),
      role: currentUser?.role || '',
      emoji: currentUser?.emoji || '',
      coffeeBalance: currentUser?.coffeeBalance || 0,
      isApproved: currentUser?.isApproved?? null,
      departmentId: currentUser?.departmentId?? null,
      projectIds: currentUser?.projectIds || []
    });

    this.teamService.updateMember(updatedUser);
    this.selectedUserForEdit.set(null);
  }

  public onClosePopup(): void {
    this.selectedUserForEdit.set(null);
  }

  @HostListener('document:keydown.escape', ['$event'])
  public handleEscape(event: Event): void {
    if (this.selectedUserForEdit()) {
      this.onClosePopup();
    }
  }

  public closeError(): void {
    this.errorFromServer.set("");
  }
}