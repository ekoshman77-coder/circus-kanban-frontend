import { CanActivateFn, Router } from "@angular/router";
import { UserService } from "../services/user/user-service";
import { inject } from "@angular/core";
import { DepartmentService } from "../services/admin/department-service";

export const adminGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const departmentService = inject(DepartmentService)
  const router = inject(Router);

  // Wenn der User eingeloggt ist, darf er passieren!
  if (userService.isLoggedIn() && departmentService.isAdmin()) {
    return true;
  }

  // Wenn nicht, leiten wir ihn knallhart zur Startseite (Login) um
  console.warn('Zugriff verweigert: Du bist kein admin!');
  router.navigate(['/todopage']);
  return false;
};