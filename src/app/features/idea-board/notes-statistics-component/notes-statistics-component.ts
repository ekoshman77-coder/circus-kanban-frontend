import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notes-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notes-statistics-component.html',
  styleUrls: ['./notes-statistics-component.css']
})
export class NotesStatisticsComponent {
  // Inputs vom Hauptboard
  public allNotes = input<any[]>([]);
  public filteredNotes = input<any[]>([]);

  // Zustand: Ist die Sidebar geöffnet?
  public isSidebarOpen = signal<boolean>(false);

  public boardStatistics = computed(() => {
    const total = this.allNotes().length;
    const filtered = this.filteredNotes().length;

    const colorCounts: { [key: string]: number } = {
      'note-yellow': 0,
      'note-green': 0,
      'note-pink': 0,
      'note-blue': 0
    };

    this.filteredNotes().forEach(vm => {
      if (vm.note.colorType && colorCounts[vm.note.colorType] !== undefined) {
        colorCounts[vm.note.colorType]++;
      }
    });

    if (filtered === 0) {
      return {
        totalCount: total,
        filteredCount: filtered,
        isFilteredActive: total !== filtered,
        colorCounts,
        conicGradient: '#e2e8f0 0deg 360deg'
      };
    }

    const pYellow = (colorCounts['note-yellow'] / filtered) * 100;
    const pGreen = (colorCounts['note-green'] / filtered) * 100;
    const pPink = (colorCounts['note-pink'] / filtered) * 100;

    const stop1 = (pYellow / 100) * 360;
    const stop2 = stop1 + ((pGreen / 100) * 360);
    const stop3 = stop2 + ((pPink / 100) * 360);

    const cYellow = '#fde047';
    const cGreen = '#4ade80';
    const cPink = '#f472b6';
    const cBlue = '#60a5fa';

    const conicGradient = `conic-gradient(
      ${cYellow} 0deg ${stop1}deg,
      ${cGreen} ${stop1}deg ${stop2}deg,
      ${cPink} ${stop2}deg ${stop3}deg,
      ${cBlue} ${stop3}deg 360deg
    )`;

    return {
      totalCount: total,
      filteredCount: filtered,
      isFilteredActive: total !== filtered,
      colorCounts,
      conicGradient
    };
  });

  public toggleSidebar(): void {
    this.isSidebarOpen.update(prev => !prev);
  }
}