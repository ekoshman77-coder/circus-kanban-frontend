import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-select-role-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './select-role-modal.html',
  styleUrl: './select-role-modal.css'
})
export class SelectRoleModal {
  public options = input<string[]>([]);
  public emojiMap = input<Record<string, string>>({});
  
  // 🎯 Two-Way Binding per model()
  public selected = model<string>('');

  public select = output<void>();
  public cancel = output<void>();

  public onConfirm(): void {
    this.select.emit(); // Sagt der Elternkomponente: "Du kannst den Wert jetzt übernehmen!"
  }

  public onCancel(): void {
    this.cancel.emit();
  }

  public getRoleEmoji(name: string): string {
    return this.emojiMap()[name] ?? '👤';
  }
}