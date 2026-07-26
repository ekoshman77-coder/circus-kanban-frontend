import { Injectable, signal } from '@angular/core';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

/** Die verfügbaren Filterkategorien für die systemweite Suche. */
export type SearchCategory = 'all' | 'team' | 'projects' | 'ideas' | 'milestones' | 'todos';

/**
 * Service für die globale Verwaltung von Filter- und Suchzuständen.
 * * **Architektur-Highlight:** Nutzt Angular Signals für ein leichtgewichtiges,
 * reaktives State-Management ohne den Overhead komplexer RxJS-Streams[cite: 6].
 * Ermöglicht es verschiedenen Komponenten (z. B. der Suchleiste im Header und den
 * Listenansichten auf den Boards), sich synchron auf denselben Filterzustand aufzuschalten[cite: 6].
 */
@Injectable({
  providedIn: 'root'
})
export class FilterService extends BaseDataManager {
  
  /** Der aktuelle globale Suchbegriff, den der Benutzer eingegeben hat. */
  public searchTerm = signal<string>('');
  
  /** Die aktuell ausgewählte Suchkategorie zur Eingrenzung der Ergebnisse. */
  public currentCategory = signal<SearchCategory>('all');
  
  /** Spezial-Filter für dringende Alarme (z. B. Kaffeekassen-Schulden oder gesperrte Instanzen). */
  public showOnlyAlerts = signal<boolean>(false);

  /**
   * Setzt die Standard-Kategorie beim Navigieren auf eine neue Seite.
   * Setzt gleichzeitig den Suchbegriff und die Spezial-Filter zurück, um
   * unerwartete Filter-Überlagerungen für den Benutzer zu vermeiden[cite: 6].
   * * @param category Die Kategorie, die initial aktiv sein soll[cite: 6].
   */
  public setInitialCategory(category: SearchCategory): void {
    this.currentCategory.set(category);
    this.searchTerm.set(''); 
    this.showOnlyAlerts.set(false);
  }

  /**
   * Setzt alle Filter und Suchbegriffe sofort auf ihre Standardwerte zurück[cite: 6].
   */
  public resetAll(): void {
    this.searchTerm.set('');
    this.currentCategory.set('all');
    this.showOnlyAlerts.set(false);
  }

  public override resetData(): void {
    this.searchTerm.set('');
    this.currentCategory.set('all');
    this.showOnlyAlerts.set(false);
  }
}