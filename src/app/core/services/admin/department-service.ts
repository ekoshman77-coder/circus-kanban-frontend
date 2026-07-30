import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { DepartmentRepository, IDepartment } from '../../repositories/department-repository';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { ADMIN_DEPARTMENT_NAME } from '../../shared/constants/admin-constants';

@Injectable({
  providedIn: 'root',
})
export class DepartmentService extends BaseDataManager { // 👈 ERBT JETZT VOM MANAGER!
  private departmentRepo = inject(DepartmentRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService)

  private static readonly DEPARTMENTS_CACHE_KEY = 'cached_departments';

  private departmentsSignal = signal<IDepartment[]>([]);
  public departments = computed(() => this.departmentsSignal());

  public isAdmin = computed(() => {
    const currentDeptId = this.userService.currentUser()?.departmentId;
    if (!currentDeptId) return false;

    const userDepartment = this.departments().find((dep) => dep.id === currentDeptId);
    return userDepartment?.name.toLowerCase() === ADMIN_DEPARTMENT_NAME.toLowerCase();
  });
  
  constructor() {
    super(); // 👈 WICHTIG: Ruft den Konstruktor von BaseDataManager auf, der die Registrierung regelt!

    // 📴 Beim Start direkt den Cache laden
    const cached = this.localStorageService.getItem<IDepartment[]>(DepartmentService.DEPARTMENTS_CACHE_KEY);
    if (cached) {
      this.departmentsSignal.set(cached);
    }
    effect(() => {
      const isLoggedIn = this.userService.isLoggedIn();
      const connectionStatus = this.connectionService.status(); // Lauscht auf UNKNOWN, ONLINE, OFFLINE

      // Wir laden NUR, wenn ein User da ist UND wir nicht aktiv offline sind!
      if (isLoggedIn && connectionStatus !== 'OFFLINE') {
        console.log(`🔄 [DepartmentService] Wächter triggert Laden. Status: ${connectionStatus}`);
        this.loadDepartments();
      }
    });
  }

  /**
   * 🧹 DIE ZWANGSMETHODE VOM VATER (BaseDataManager):
   * Wird beim Logout vollautomatisch aufgerufen!
   */
  public override resetData(): void {
    console.log('🧹 [DepartmentService] Logout registriert: Bereinige Cache und Signal-State.');
    this.departmentsSignal.set([]); // Signal leeren
    this.localStorageService.removeItem(DepartmentService.DEPARTMENTS_CACHE_KEY); // LocalStorage säubern
  }

  public loadDepartments(): void {
    if (this.connectionService.isOffline()) {
      console.log('📴 [DepartmentService] Offline. Nutze Cache.');
      return;
    }

    this.departmentRepo.getAll$().subscribe({
      next: (data) => {
        this.departmentsSignal.set(data);
        this.localStorageService.setItem(DepartmentService.DEPARTMENTS_CACHE_KEY, data);
      },
      error: (err) => console.error('Fehler beim Laden der Abteilungen:', err)
    });
  }

  public createDepartment(name: string): void {
    if (this.connectionService.isOffline()) return;

    this.departmentRepo.create$(name).subscribe({
      next: (newDept) => {
        this.departmentsSignal.update((current) => {
          const updated = [...current, newDept];
          this.localStorageService.setItem(DepartmentService.DEPARTMENTS_CACHE_KEY, updated);
          return updated;
        });
      },
      error: (err) => alert(err.error?.message || 'Fehler beim Erstellen')
    });
  }

  public updateDepartment(id: string, newName: string): void {
    if (this.connectionService.isOffline()) return;

    this.departmentRepo.update$(id, newName).subscribe({
      next: (updatedDept) => {
        this.departmentsSignal.update((current) => {
          const updated = current.map((dept) => (dept.id === id ? updatedDept : dept));
          this.localStorageService.setItem(DepartmentService.DEPARTMENTS_CACHE_KEY, updated);
          return updated;
        });
      },
      error: (err) => alert(err.error?.message || 'Fehler beim Aktualisieren')
    });
  }

  public deleteDepartment(id: string): void {
    if (this.connectionService.isOffline()) return;

    this.departmentRepo.delete$(id).subscribe({
      next: () => {
        this.departmentsSignal.update((current) => {
          const updated = current.filter((dept) => dept.id !== id);
          this.localStorageService.setItem(DepartmentService.DEPARTMENTS_CACHE_KEY, updated);
          return updated;
        });
      },
      error: (err) => alert(err.error?.message || 'Fehler beim Löschen')
    });
  }
}