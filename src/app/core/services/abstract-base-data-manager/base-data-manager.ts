import { inject } from '@angular/core';
import { LocalStorageService } from '../user/local-storage-service';
import { ResettableDataService } from './ressettable-data-service';

export abstract class BaseDataManager implements ResettableDataService { // 👈 Implementiert das Interface!
  protected localStorageService = inject(LocalStorageService);

  constructor() {
    // Funktioniert, weil "this" durch die Vererbung auch das Interface erfüllt!
    this.localStorageService.register(this);
  }

  // Zwingt die Kinder weiterhin dazu, die Methode zu schreiben
  public abstract resetData(): void;
}