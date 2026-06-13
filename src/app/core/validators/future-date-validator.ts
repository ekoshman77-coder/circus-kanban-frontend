import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function futureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    // Wenn das Feld leer ist, schlägt dieser Validator nicht an 
    // (dafür ist Validators.required zuständig!)
    if (!value) {
      return null;
    }

    const inputDate = new Date(value).getTime();
    const today = new Date().setHours(0, 0, 0, 0); // Heute um 00:00 Uhr

    // Wenn das eingegebene Datum vor heute liegt, geben wir einen Fehler zurück
    if (inputDate < today) {
      // Das hier ist das Fehler-Objekt. 
      // Der Key 'dateInPast' ist frei erfunden und wird später im TS/HTML abgefragt.
      return { dateInPast: true }; 
    }

    // Alles okay? Dann geben wir null zurück
    return null;
  };
}