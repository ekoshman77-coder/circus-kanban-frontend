import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export function uniqueDepartmentNameValidator(getExistingNames: () => string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value?.trim().toLowerCase();
    if (!value) return null; // "required" kümmert sich um leere Werte

    const existingNames = getExistingNames().map(name => name.toLowerCase());
    const exists = existingNames.includes(value);

    return exists ? { departmentNameExists: true } : null;
  };
}