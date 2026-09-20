import { inject, signal, Signal } from '@angular/core';
import { LocalStorageService } from '../../user/local-storage-service';

export abstract class StateProvider<T> {
  protected localStorageService = inject(LocalStorageService);
  protected abstract storageKey: string;

  protected rawState: T;
  protected uiSignal: ReturnType<typeof signal<T>>;
  protected isShadowMode: boolean = false;
  private initialState: T;

  constructor(initialState: T) {
    this.initialState = initialState;
    this.rawState = initialState;
    this.uiSignal = signal<T>(initialState);
  }

  // 📦 Einheitlicher Zugriff auf den State
  public getState(): T {
    return this.rawState;
  }

  public getSignal(): Signal<T> {
    return this.uiSignal.asReadonly();
  }

  protected saveToCache(): void {
    if (!this.storageKey) return;
    this.localStorageService.setItem(this.storageKey, this.rawState);
  }

  protected commitToUI(): void {
    this.saveToCache();
    this.uiSignal.set(this.rawState);
  }

  public resetState(): void {
    if (this.storageKey) {
      this.localStorageService.removeItem(this.storageKey);
    }
    this.setRawState(this.initialState);
  }

  protected setRawState(newState: T): void {
    this.rawState = newState;

    // Im Shadow Mode (beim Durchspülen): Weder UI noch LocalStorage anrühren!
    if (!this.isInShadowMode()) {
      this.commitToUI();
    }
  }

  // 🆔 ID-Ersetzung (Standard: Nichts tun für Objekte ohne IDs)
  public replaceId(localId: string, serverId: string): void {}

  // 📸 Snapshots & Caching
  public abstract createSnapshot(): any;
  public abstract restoreFromSnapshot(snapshot: unknown): void;
  public abstract loadFromCache(): void;

  // ⏩ Forward Replay / Optimistic Update im Provider (Ohne QueueItem-Abhängigkeit!)
  public abstract applyActionPayload(action: string, payload: any): void;

  // 🕶️ Shadow-Modus Steuerung
  public enterShadowMode(): void { 
    this.isShadowMode = true; 
  }

  public exitShadowMode(): void { 
    this.isShadowMode = false; 
    this.commitToUI();
  }
  
  public isInShadowMode(): boolean { 
    return this.isShadowMode; 
  }
}