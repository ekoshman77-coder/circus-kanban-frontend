import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Project } from '../../../models/project';

export type OverviewFilter = 'all' | 'private' | 'my-team' | 'team' | string;

export interface FilterView {
  id: string,
  label: string
}

@Component({
  selector: 'app-stat-filter-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-filter-bar-component.html',
  styleUrl: './stat-filter-bar-component.css',
})
export class StatFilterBarComponent {
  // Inputs
  public myProjects = input<Project[]>([]);
  public activeFilter = input<OverviewFilter>('all');
  public showScopesFilter = input<boolean>(true);

  // Output
  public filterChange = output<OverviewFilter>();

  // ⚡ REAKTIV: compute die verfügbaren Buttons dynamisch!
  // Kein constructor, kein manueller .set() Aufruf nötig.
  protected availableScopes = computed(() => {
    if (this.showScopesFilter()) {
      return [
        { id: 'all', label: '📋 Gesamt' },
        { id: 'private', label: '👤 Nur Privat' },
        { id: 'my-team', label: '🛠️ Meine Beiträge' },
        { id: 'team', label: '👥 Gesamtes Team' }
      ];
    } else {
      // Wenn keine Scopes gewünscht sind (z.B. in der Übersicht), nur "Gesamt" anbieten
      return [
        { id: 'all', label: '📋 Gesamt' }
      ];
    }
  });

  protected allFilters = computed(() => {
    const projectFilters = this.myProjects().map(project => {
      return {id: project.id, label: `🚀 ${project.title}`}
    })
    return [...this.availableScopes(), ...projectFilters]
  })

  public selectFilter(filterId: OverviewFilter): void {
    // Wenn bereits ausgewählt, müssen wir nichts tun
    if (this.activeFilter() === filterId) return;
    console.log("StatFilterBarComponent selectFilter", filterId)

    this.filterChange.emit(filterId);
  }
}