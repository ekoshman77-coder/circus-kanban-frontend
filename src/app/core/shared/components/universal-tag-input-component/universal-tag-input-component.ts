import { Component, effect, EventEmitter, inject, input, OnInit, Output, signal } from '@angular/core';
import { UniversalPredictorService } from '../../../services/universal-predictor-service';
import { UserService } from '../../../services/user/user-service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-universal-tag-input-component',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './universal-tag-input-component.html',
  styleUrl: './universal-tag-input-component.css',
})
export class UniversalTagInputComponent implements OnInit {
  private predictorService = inject(UniversalPredictorService);
  private userService = inject(UserService);

  // Die schlanken Inputs von der Mutter-Komponente (z.B. IdeaBoard)
  public textToWatch = input<string>('');
  public contextType = input<'todo' | 'note'>('todo');
  public placeholder = input<string>('Kategorie...');
  public initialValue = input<string>('');
  
  // Die fertigen Kategorien-Strings vom Board für den Offline-Fall
  public currentCategories = input<string[]>([]); 

  // Interne UI-Signale
  public textInput = signal<string>('');
  public suggestedTag = signal<string | null>(null);
  public isDropdownOpen = signal<boolean>(false);
  public availableTags = signal<string[]>([]); // Hält die Optionen für das Template

  private lastPredictedText = '';

  constructor() {
    // 🔮 NUR NOCH EIN EFFEKT: KI-Vorschlag beim Tippen überwachen
    effect(() => {
      const text = this.textToWatch().trim();
      if (text.length > 2) {
        this.fetchAiSuggestion(text);
      } else {
        this.suggestedTag.set(null);
      }
    });

    // 🧹 Reset-Wachhund nach dem Speichern
    effect(() => {
      if (this.initialValue() === '') {
        this.textInput.set('');
        this.suggestedTag.set(null);
      }
    });
  }

  ngOnInit(): void {
    if (this.initialValue()) {
      this.textInput.set(this.initialValue());
    }
  }

  /**
   * 🔓 GENIALES TIMING: Wird aufgerufen, wenn der User den Pfeil klickt!
   */
  public async toggleDropdown(): Promise<void> {
    const wirdGeoeffnet = !this.isDropdownOpen();
    this.isDropdownOpen.set(wirdGeoeffnet);

    // 🔥 Genau hier passiert das Update live beim Öffnen:
    if (wirdGeoeffnet) {
      const userId = this.userService.getCurrentUserId();
      if (!userId) return;

      try {
        // Wir übergeben dem Service einfach nur die 3 sauberen Infos
        const frischeKategorien = await this.predictorService.getAvailableCategories(
          userId,
          this.contextType(),
          this.currentCategories() // Das String-Array als Offline-Sicherheitsnetz
        );

        // Signal updaten -> UI rendert parallel die Optionen
        this.availableTags.set(frischeKategorien);
      } catch (err) {
        console.error('Fehler beim Laden der Dropdown-Kategorien:', err);
      }
    }
  }

  /**
   * KI-Suggestion beim Tippen abrufen (Radikal vereinfacht auf 3 Parameter!)
   */
  private async fetchAiSuggestion(text: string): Promise<void> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    if (text === this.lastPredictedText) return;
    this.lastPredictedText = text;

    try {
      // Keine Listen, kein Suchen nach Feldern – der Service macht das jetzt autonom!
      const vorschlag = await this.predictorService.predict(text, userId, this.contextType());
      this.suggestedTag.set(vorschlag || null);
    } catch (err) {
      console.error('Fehler bei Service-Vorhersage:', err);
      this.suggestedTag.set(null);
    }
  }

  public updateValue(value: string): void {
    this.textInput.set(value);
    this.valueChanged.emit(value);
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