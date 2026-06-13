import { Injectable, signal } from '@angular/core';
import { Project } from '../../core/models/project';

export enum BoardTab {
  Pinboard = 'pinboard',
  Calculator = 'calculator',
  Projects = 'projects',
  Milestones = 'milestones', 
  IdeaBoard = "IdeaBoard",
  team = "team"
}

export interface NavigationState {
  type: 'idea' | 'project' | 'milestone' | 'team';
  id: string;
}

@Injectable({
  providedIn: 'root' // Macht den Service app-weit als Singleton verfügbar
})
export class TabNavigationService {
  // 🧭 1. Welcher Tab ist aktiv?
  public activeTab = signal<BoardTab>(BoardTab.Pinboard);

  // 📦 2. Welches Projekt wird gerade im System fokussiert (z.B. kalkuliert)?
  public currentProject = signal<Project | null>(null);

  /**
   * 🕹️ Die Steuer-Zentrale: Wechselt den Tab und nimmt optional Projektdaten mit!
   */
  public currentNavigationState = signal<NavigationState | null>(null);

  public changeTab(tab: BoardTab, state: NavigationState | null = null) {
   this.activeTab.set(tab);
   this.currentNavigationState.set(state);
  }
}