import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../../core/services/team-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserModel } from '../../../core/models/user-model';
import { TeamPoolComponent } from '../team-pool-component/team-pool-component';
import { TeamAssigmentComponent } from '../team-assigment/team-assigment-component/team-assigment-component';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TeamPoolComponent, TeamAssigmentComponent],
  templateUrl: './team-management-component.html',
  styleUrl: './team-management-component.css'
})
export class TeamManagementComponent {
  // 🎯 Der Lehrer-Tipp: Ein String-Signal steuert, was sichtbar ist.
  // Startwert ist 'gallery' (deine Team-Pool-Ansicht)
  public activeTab = signal<'gallery' | 'assignment'>('gallery');

  // Methode zum Umschalten
  public setTab(tab: 'gallery' | 'assignment'): void {
    this.activeTab.set(tab);
  }
}