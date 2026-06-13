import { Component, input, output, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-universal-popup-component',
  standalone: true,
  imports: [],
  templateUrl: './universal-popup-component.html',
  styleUrl: './universal-popup-component.css',
})
export class UniversalPopupComponent<T = unknown> implements OnInit, OnDestroy { // 🌟 <T> macht die Klasse generisch!
  public animationIcon = input<string>('🚀');
  public title = input.required<string>();
  public message = input.required<string>();
  
  public confirmText = input<string | null>(null); 
  public cancelText = input<string>('Abbrechen');
  public mode = input<'success' | 'danger'>('success'); 
  public showLoadingBar = input<boolean>(false);
  public timerMs = input<number>(4000); 

  // 📦 NEU & REIN: Das Popup nimmt Daten vom Typ T entgegen (z.B. Project oder Todo)
  public dataContext = input<T | null>(null);

  // 💥 NEU: Das Output schickt nach Ablauf des Timers exakt den Typ T wieder mit zurück!
  public confirm = output<T | null>(); 
  public cancel = output<void>();

  private internalTimerId: any = null;

  public ngOnInit(): void {
    if (this.showLoadingBar()) {
      this.internalTimerId = setTimeout(() => {
        this.onConfirm(); 
      }, this.timerMs());
    }
  }

  public ngOnDestroy(): void {
    this.clearActiveTimer();
  }

  public onConfirm(): void {
    this.clearActiveTimer();
    // 🚀 Wir emitten den eingefrorenen dataContext!
    this.confirm.emit(this.dataContext());
  }

  public onCancel(): void {
    this.clearActiveTimer();
    this.cancel.emit();
  }

  private clearActiveTimer(): void {
    if (this.internalTimerId) {
      clearTimeout(this.internalTimerId);
      this.internalTimerId = null;
    }
  }
}