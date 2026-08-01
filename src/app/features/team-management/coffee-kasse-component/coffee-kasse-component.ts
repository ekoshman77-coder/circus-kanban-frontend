import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { UserModel } from '../../../core/models/user-model';
import { TeamService } from '../../../core/services/team/team-service';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user/user-service';

@Component({
  selector: 'app-coffee-kasse',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coffee-kasse-component.html',
  styleUrls: ['./coffee-kasse-component.css']
})
export class CoffeeKasseComponent implements OnInit {
  private teamService = inject(TeamService);
  private userService = inject(UserService);

  public currentUserId = computed(() => this.userService.getCurrentUserId());

  // 🎯 DEIN LIEBLINGS-COMPUTED: Gibt dir direkt die flachen UserModel-Objekte!
  public members = computed(() => {
    const memb = this.teamService.globalMembersSignal().map(member => member.user)
    console.log("CoffeeKasse members", memb)
    return memb;
  });
  
  public editingUserId = signal<string | null>(null);
  public tempRole = '';
  public tempEmoji = '';

  public readonly EMOJI_POOL = [
    '🦊', '🦁', '🐼', '🐨', '🐯', '🦝', '🐸', '🦉', '🦄', '🐝',
    '🐱', '🐶', '🐗', '🐺', '🦔', '🐒', '🐔', '🐧', '🦅', '🦆'
  ];

  public readonly ROLES_POOL = [
    'Kaffee-Junkie ☕', 'Espresso-Experte ☕', 'Cappuccino-Chef 🥛', 
    'Filterkaffee-Fan ☕', 'Teetrinker-Spion 🍵', 'Code-Koffeinier 👩‍💻'
  ];

  public startEditing(member: UserModel): void {
    this.editingUserId.set(member.id);
    // Falls role oder emoji undefined sind, fangen wir das hier sauber ab:
    this.tempRole = member.role || 'Kaffee-Junkie ☕';
    this.tempEmoji = member.emoji || '🦊';
  }

  public cancelEditing(): void {
    this.editingUserId.set(null);
  }

  ngOnInit(): void {
    this.teamService.loadGlobalPool()
  }

  public saveProfile(member: UserModel): void {
    if (!(this.tempRole.trim())) this.tempRole = 'Kaffee-Junkie ☕';
    this.teamService.updateCoffeeAccount(member.id, member.coffeeBalance, this.tempRole, this.tempEmoji);
    this.editingUserId.set(null);
  }

  public isMemberGesperrt(member: UserModel): boolean {
    if (!member || !(member.id)) return false;
    return member.coffeeBalance <= -5.00;
  }

  public getMemberStatusText(member: UserModel): string {
    return this.isMemberGesperrt(member) ? 'Gesperrt ❌' : 'Aktiv  ';
  }

  public onDrinkCoffee(member: UserModel): void {
    if (this.isMemberGesperrt(member)) return;
    const newBalance = member.coffeeBalance - 1.00; 
    this.teamService.updateCoffeeAccount(member.id, newBalance, member.role || 'Kaffee-Junkie ☕', member.emoji || '🦊');
  }

  public onAddMoney(member: UserModel): void {
    const newBalance = member.coffeeBalance + 5.00;
    this.teamService.updateCoffeeAccount(member.id, newBalance, member.role || 'Kaffee-Junkie ☕', member.emoji || '🦊');
  }
}