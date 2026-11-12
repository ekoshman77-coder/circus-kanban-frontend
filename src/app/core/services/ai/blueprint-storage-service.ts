import { Injectable } from '@angular/core';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { DailyBlueprintViewModel } from '../../models/recommendation-view-models';
import { Todo } from '../../models/todo';

@Injectable({
  providedIn: 'root'
})
export class BlueprintStorageService extends BaseDataManager {
  private static readonly CACHE_KEY = 'daily_blueprint_cache';
  private static readonly DATE_KEY = 'daily_blueprint_date';
  private static readonly REJECTIONS_KEY = 'daily_blueprint_rejections';
  private static readonly ACCEPTED_KEY = 'daily_blueprint_accepted';

  constructor() {
    super(); // 👈 Registriert den Service automatisch im LocalStorageService!
  }

  /**
   * Wird beim Logout durch LocalStorageService.clearAllSessionData() aufgerufen
   */
  public override resetData(): void {
    this.clearPersistedBlueprint();
  }

  public getPersistedBlueprint(): DailyBlueprintViewModel | null {
    const savedDate = this.localStorageService.getItem<string>(BlueprintStorageService.DATE_KEY);
    const today = new Date().toLocaleDateString('sv-SE');

    if (savedDate !== today) {
      this.clearPersistedBlueprint();
      return null;
    }

    const savedData = this.localStorageService.getItem<DailyBlueprintViewModel>(BlueprintStorageService.CACHE_KEY);
    if (!savedData) return null;

    if (savedData.slots) {
      savedData.slots = savedData.slots.map((slot: any) => ({
        ...slot,
        recommendations: slot.recommendations?.map((rec: any) => ({
          ...rec,
          todo: rec.todo ? Todo.fromJson(rec.todo) : rec.todo
        }))
      }));
    }

    return savedData;
  }

  public getPersistedBuffers(): { rejections: string[]; accepted: string[] } {
    const savedDate = this.localStorageService.getItem<string>(BlueprintStorageService.DATE_KEY);
    const today = new Date().toLocaleDateString('sv-SE');

    if (savedDate !== today) {
      return { rejections: [], accepted: [] };
    }

    return {
      rejections: this.localStorageService.getItem<string[]>(BlueprintStorageService.REJECTIONS_KEY) ?? [],
      accepted: this.localStorageService.getItem<string[]>(BlueprintStorageService.ACCEPTED_KEY) ?? []
    };
  }

  public persistBlueprint(vm: DailyBlueprintViewModel | null): void {
    const today = new Date().toLocaleDateString('sv-SE');
    if (vm) {
      this.localStorageService.setItem(BlueprintStorageService.CACHE_KEY, vm);
      this.localStorageService.setItem(BlueprintStorageService.DATE_KEY, today);
    } else {
      this.clearPersistedBlueprint();
    }
  }

  public persistBuffers(rejections: string[], accepted: string[]): void {
    this.localStorageService.setItem(BlueprintStorageService.REJECTIONS_KEY, rejections);
    this.localStorageService.setItem(BlueprintStorageService.ACCEPTED_KEY, accepted);
  }

  public clearPersistedBlueprint(): void {
    this.localStorageService.removeItem(BlueprintStorageService.CACHE_KEY);
    this.localStorageService.removeItem(BlueprintStorageService.DATE_KEY);
    this.localStorageService.removeItem(BlueprintStorageService.REJECTIONS_KEY);
    this.localStorageService.removeItem(BlueprintStorageService.ACCEPTED_KEY);
  }
}