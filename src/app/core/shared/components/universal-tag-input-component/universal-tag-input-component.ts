import { Component, effect, EventEmitter, inject, input, OnInit, Output, signal, OnDestroy } from '@angular/core';
import { UniversalPredictorService } from '../../../services/universal-predictor-service';
import { UserService } from '../../../services/user/user-service';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-universal-tag-input-component',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './universal-tag-input-component.html',
  styleUrl: './universal-tag-input-component.css',
})
export class UniversalTagInputComponent implements OnInit, OnDestroy {
  private predictorService = inject(UniversalPredictorService);
  private userService = inject(UserService);

  public textToWatch = input<string>('');
  public contextType = input<'todo' | 'note'>('todo');
  public placeholder = input<string>('Kategorie...');
  public initialValue = input<string>('');
  public currentCategories = input<string[]>([]);

  // Interne UI-Signale
  public textInput = signal<string>('');
  public suggestedTag = signal<string | null>(null);
  public isDropdownOpen = signal<boolean>(false);
  public availableTags = signal<string[]>([]);
  public isAiLoading = signal<boolean>(false);
  public isUserTyping = signal<boolean>(false);

  // 🧠 NEU: Ein RxJS-Strom für das Tippen und die Abo-Verwaltung
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  constructor() {
    // Der Effekt triggert jetzt nicht mehr die AI direkt, sondern füttert nur den RxJS-Strom
    effect(() => {
      // 1. Wir überwachen den Aufgabentext für die KI
      const text = this.textToWatch().trim();
      if (text.length > 2) {
        this.isUserTyping.set(true);
        this.suggestedTag.set(null); 
        this.searchSubject.next(text); 
      } else {
        this.suggestedTag.set(null);
        this.isUserTyping.set(false);
        this.isAiLoading.set(false);
      }

      // 2. 🚀 DIE BUG-RETTUNG: Wir lauschen JETZT HIER reaktiv auf das Zurücksetzen von außen!
      // Wenn das Formular die Kategorie leert (''), leeren wir sofort das interne Eingabefeld.
      this.textInput.set(this.initialValue());
    });
  }

  ngOnInit(): void {
    if (this.initialValue()) {
      this.textInput.set(this.initialValue());
    }

    // 🚦 Hier bremsen wir das Tippen aus!
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),        // ⏳ Warte 400ms nach dem LETZTEN Tastendruck
      distinctUntilChanged()    // 🎯 Schieße nur los, wenn sich der Text wirklich verändert hat
    ).subscribe(text => {
      this.fetchAiSuggestion(text);
    });
  }

  ngOnDestroy(): void {
    // 🧼 Saubermachen, wenn die Komponente zerstört wird
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  public async toggleDropdown(): Promise<void> {
    const wirdGeoeffnet = !this.isDropdownOpen();
    this.isDropdownOpen.set(wirdGeoeffnet);

    if (wirdGeoeffnet) {
      const userId = this.userService.getCurrentUserId();
      if (!userId) return;

      try {
        const frischeKategorien = await this.predictorService.getAvailableCategories(
          userId,
          this.contextType(),
          this.currentCategories()
        );
        this.availableTags.set(frischeKategorien);
      } catch (err) {
        console.error('Fehler beim Laden der Dropdown-Kategorien:', err);
      }
    }
  }

  private async fetchAiSuggestion(text: string): Promise<void> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    // 🚀 Erst JETZT, nach der Denkpause, schalten wir die UI-Animationen an!
    this.isAiLoading.set(true);

    try {
//      await new Promise(resolve => setTimeout(resolve, 1000));
      const vorschlag = await this.predictorService.predict(text, userId, this.contextType());

      // Nur wenn der neue Vorschlag anders ist als der aktuelle, updaten wir (verhindert zappeln)
      if (this.suggestedTag() !== vorschlag) {
        this.suggestedTag.set(vorschlag || null);
      }
    } catch (err) {
      console.error('Fehler bei Service-Vorhersage:', err);
      this.suggestedTag.set(null);
    } finally {
      // 🧼 Wenn alles fertig ist, schalten wir BEIDE Lade-Zustände aus
      this.isAiLoading.set(false);
      this.isUserTyping.set(false); // 🌟 NEU!
    }
  }

  public updateValue(value: string): void {
    this.textInput.set(value);
    this.valueChanged.emit(value);

    if (this.isDropdownOpen()) {
      this.isDropdownOpen.set(false);
    }
  }

  public acceptAiSuggestion(): void {
    const vorschlag = this.suggestedTag();
    if (vorschlag) {
      this.updateValue(vorschlag);
      this.suggestedTag.set(null);
      this.isDropdownOpen.set(false);
    }
  }

  public selectFromDropdown(tag: string): void {
    this.updateValue(tag);
    this.isDropdownOpen.set(false);
  }

  @Output() public valueChanged = new EventEmitter<string>();
}