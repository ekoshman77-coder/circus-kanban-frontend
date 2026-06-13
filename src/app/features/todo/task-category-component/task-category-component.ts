import { Component, inject, input, output, signal, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user/user-service';
import { TodoService } from '../../../core/services/todo/todo-service';

@Component({
  selector: 'app-task-category',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './task-category-component.html',
  styleUrls: ['./task-category-component.css']
})
export class TaskCategoryComponent implements OnInit {
  private todoService = inject(TodoService);
  private userService = inject(UserService);

  // 📥 INPUTS
  public taskName = input<string>(''); 
  public initialCategory = input<string>(''); // Für den Edit-Modus

  // 📤 OUTPUT
  public categoryChanged = output<string>();

  // 🏷️ REAKTIVE SIGNALS
  public categoryInput = signal<string>('');
  public suggestedCategory = signal<string | null>(null);
  public isDropdownOpen = signal<boolean>(false);
  public availableCategories = signal<string[]>([]);

  private lastPredictedText = ''; // Verhindert doppelte Server-Anfragen

  constructor() {
    /**
     * 🔮 DER REAKTIVE LIVE-CHECKER
     * Schaut dem `taskName`-Signal live beim Tippen zu.
     */
    effect(() => {
      const aktuellerText = this.taskName().trim();
      
      // Erst ab 3 Zeichen wird die Server-KI gefragt
      if (aktuellerText.length >= 3) {
        this.fetchAiSuggestion(aktuellerText);
      } else {
        this.suggestedCategory.set(null);
        this.lastPredictedText = '';
      }
    });
  }

  ngOnInit(): void {
    this.loadServerCategories();
    
    // Voraussortierung für den Edit-Modus
    if (this.initialCategory()) {
      this.categoryInput.set(this.initialCategory());
    }
  }

  public loadServerCategories(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.todoService.getServerCategories(userId).subscribe({
      next: (categories) => {
        if (categories && categories.length > 0) {
          this.availableCategories.set(categories);
        } else {
          this.availableCategories.set(['Arbeit', 'Privat', 'Sport', 'Finanzen', 'Allgemein']);
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden der Server-Kategorien:', err);
        this.availableCategories.set(['Arbeit', 'Privat', 'Sport', 'Finanzen', 'Allgemein']);
      }
    });
  }

  /**
   * 🤖 Holt den KI-Vorschlag live ab
   */
  private fetchAiSuggestion(text: string): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    // Schutz vor identischen Anfragen bei unnötigen Tastenanschlägen (z.B. Shift-Taste)
    if (text === this.lastPredictedText) {
      return;
    }
    this.lastPredictedText = text;

    this.todoService.getAiCategorySuggestion(text, userId).subscribe({
      next: (response) => {
        if (response && response.suggestedCategory) {
          this.suggestedCategory.set(response.suggestedCategory);
        } else {
          this.suggestedCategory.set(null);
        }
      },
      error: (err) => {
        console.error('Fehler beim KI-Kategorie-Check:', err);
        this.suggestedCategory.set(null);
      }
    });
  }

  public updateCategory(value: string): void {
    this.categoryInput.set(value);
    this.categoryChanged.emit(value);
  }

  public acceptAiSuggestion(): void {
    const vorschlag = this.suggestedCategory();
    if (vorschlag) {
      this.updateCategory(vorschlag);
      this.suggestedCategory.set(null);
      this.isDropdownOpen.set(false); // Dropdown zuklappen
    }
  }

  public selectFromDropdown(category: string): void {
    this.updateCategory(category);
    this.isDropdownOpen.set(false);
  }

  public toggleDropdown(): void {
    this.isDropdownOpen.update(open => !open);
  }

  public resetField(): void {
    this.categoryInput.set('');
    this.suggestedCategory.set(null);
    this.lastPredictedText = '';
    this.loadServerCategories(); 
  }
}