import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { PayloadFormVisitor } from '../../payload-form-visior';
import { DraftChain, DraftChainItem } from '../../../../core/models/draft-chain';

@Component({
  selector: 'app-edit-modal-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-modal-component.html',
  styleUrl: './edit-modal-component.css',
})
export class EditModalComponent {
  private formVisitor = inject(PayloadFormVisitor);

  // Inputs & Outputs
  public chain = input.required<DraftChain>();
  public closed = output<void>();
  public saved = output<DraftChain>();

  // State Signals
  public selectedItemId = signal<string | null>(null);
  public activeForm = signal<FormGroup>(new FormGroup({}));

  // ⚡ Signal für die Live-Werte des Formulars
  public formLiveValues = signal<{ [key: string]: any }>({});

  constructor() {
    effect(() => {
      const currentChain = this.chain();
      if (currentChain && currentChain.items.length > 0) {
        const rootItem = currentChain.items.find(i => i.isRootCause) || currentChain.items[0];
        if (rootItem) {
          // 1. Formular erstellen
          const form = this.formVisitor.createForm(rootItem.queueItem);
          this.activeForm.set(form);

          // 2. Initialen Stand im Live-Signal speichern
          this.formLiveValues.set(form.value);

          // 3. Formular-Änderungen live abfangen
          form.valueChanges.subscribe(values => {
            this.formLiveValues.set(values);
          });

          // 4. Standardmäßig Root-Item auswählen
          this.selectedItemId.set(rootItem.queueItem.id);
        }
      }
    });
  }

  public selectedItem = computed(() => {
    const currentChain = this.chain();
    if (!currentChain) return null;
    return currentChain.items.find(i => i.queueItem.id === this.selectedItemId()) || null;
  });

  public rootItem = computed(() => {
    const currentChain = this.chain();
    if (!currentChain) return null;
    return currentChain.items.find(i => i.isRootCause) || currentChain.items[0];
  });

  // 🎯 DAS DYNAMISCHE LIVE-JSON
  public selectedItemJson = computed(() => {
    const item = this.selectedItem();
    if (!item || !item.queueItem.payload) return '';

    let payload = this.getUpdatedPayload(item)

    // // 🔥 WENN das Root-Cause Item gewählt ist, fügen wir die Live-Änderungen aus dem Formular ein!
    // if (item.isRootCause) {
    //   payload = {
    //     ...payload,
    //     ...this.formLiveValues()
    //   };
    // }

    // Bereinigung der internen Felder für die Anzeige
    const internalKeys = ['id', 'snapshot', 'displayInfo'];
    const domainKeys = Object.keys(payload).filter(key => !internalKeys.includes(key));

    if (domainKeys.length === 1) {
      return JSON.stringify(payload[domainKeys[0]], null, 2);
    }

    internalKeys.forEach(key => delete payload[key]);
    return JSON.stringify(payload, null, 2);
  });

  public formControlNames = computed(() => {
    return Object.keys(this.activeForm().controls);
  });

  public selectItem(item: DraftChainItem): void {
    this.selectedItemId.set(item.queueItem.id);

    // 🔒 Deaktiviere das Formular, wenn ein Folge-Item ausgewählt wird
    if (item.isRootCause) {
      this.activeForm().enable({ emitEvent: false });
    } else {
      this.activeForm().disable({ emitEvent: false });
    }
  }

  public isBooleanControl(controlName: string): boolean {
    const control = this.activeForm().get(controlName);
    return typeof control?.value === 'boolean';
  }

public saveAndRetry(): void {
    if (this.activeForm().invalid) return;

    const root = this.rootItem();
    if (!root) return;

    // 🎯 Tiefen-Update für den Root-Payload beim Speichern
    const updatedPayload = this.getUpdatedPayload(root);

    const updatedItems: DraftChainItem[] = this.chain().items.map(item => {
      if (item.queueItem.id === root.queueItem.id) {
        return {
          ...item,
          queueItem: {
            ...item.queueItem,
            payload: updatedPayload
          }
        };
      }
      return item;
    });

    this.saved.emit({
      ...this.chain(),
      items: updatedItems
    });
  }

  public close(): void {
    this.closed.emit();
  }

  /**
   * Durchsucht ein verschachteltes Objekt rekursiv nach Keys aus formValues 
   * und aktualisiert deren Werte exakt an Ort und Stelle.
   */
  private deepUpdatePayload(target: any, formValues: { [key: string]: any }): any {
    if (target === null || typeof target !== 'object') {
      return target;
    }

    // Falls es ein Array ist (z.B. eine Liste von Tags), jedes Element durchsuchen
    if (Array.isArray(target)) {
      return target.map(item => this.deepUpdatePayload(item, formValues));
    }

    // Kopie des aktuellen Objekts erstellen (Immutability bewahren)
    const updated = { ...target };

    for (const key of Object.keys(updated)) {
      // System-Metadaten überspringen, damit wir dort nichts versehentlich überschreiben
      if (key === 'displayInfo' || key === 'snapshot') {
        continue;
      }

      // 1. FALL: Key existiert direkt im Formular -> Wert aktualisieren
      if (Object.prototype.hasOwnProperty.call(formValues, key)) {
        updated[key] = formValues[key];
      }

      // 2. FALL: Wert ist selbst ein Unter-Objekt -> Rekursiv tiefer suchen!
      if (typeof updated[key] === 'object' && updated[key] !== null) {
        updated[key] = this.deepUpdatePayload(updated[key], formValues);
      }
    }

    return updated;
  }

  /**
   * Erzeugt den fertigen, aktualisierten Payload ausschließlich für das Root-Item.
   * Für Folgeschritte wird der Original-Payload unverändert zurückgegeben.
   */
private getUpdatedPayload(item: DraftChainItem): any {
    const originalPayload = item.queueItem.payload;

    // 🛡️ GUARD: Nur wenn es wirklich das Root-Cause-Item ist, wenden wir die Formular-Änderungen an!
    if (!item.isRootCause) {
      return originalPayload;
    }

    const liveValues = this.formLiveValues();
    return this.deepUpdatePayload(originalPayload, liveValues);
  }

}