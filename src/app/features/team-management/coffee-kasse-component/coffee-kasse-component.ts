import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { UserModel } from '../../../core/models/user-model';
import { TeamService } from '../../../core/services/team-service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { UserService } from '../../../core/services/user/user-service';

@Component({
  selector: 'app-coffee-kasse', // 🟢 Einheitlicher, sauberer Selektor!
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coffee-kasse-component.html',
  styleUrls: ['./coffee-kasse-component.css']
})
export class CoffeeKasseComponent implements OnInit, OnDestroy {
  private teamService = inject(TeamService);
  private sub?: Subscription;
  private userService = inject(UserService);

  public currentUserId = computed(() => this.userService.getCurrentUserId());

  public members = signal<UserModel[]>([]); 
  public editingUserId = signal<string | null>(null);
  public tempRole = '';
  public tempEmoji = '';

  // 🆔 Deine eigene User-ID (Setze hier testweise eine echte ID aus deiner DB ein, damit sie golden leuchtet)

  // 🎨 Der riesige Emoji-Pool zum Scrollen (inklusive 🦔)
  public readonly EMOJI_POOL = [
    '🦊', '🦁', '🐼', '🐨', '🐯', '🦝', '🐸', '🦉', '🦄', '🐝',
    '🐱', '🐶', '🐭', '🐹', '🐰', '🐻', '🐵', '🐧', '🦅', '🐺',
    '🦖', '🐉', '🐙', '🦈', '🦩', '🦥', '🦦', '🦔', '🦫', '🐦',
    '💻', '🧙‍♂️', '🥷', '🚀', '🎨', '👑', '🎧', '🎸', '🕹️', '👾',
    '🧪', '🧬', '🔭', '🛰️', '⚡', '🔥', '⚙️', '🛠️', '🔑', '💎',
    '🍕', '🥑', '🍔', '🍟', '🌮', '🍩', '🍪', '🍫', '☕', '🍺',
    '🍿', '🍦', '🍉', '🌶️', '🎲', '🎯', '🛹', '🎳', '🏆', '🎪',
    '😎', '🤓', '🤠', '🤡', '👽', '👻', '🤖', '💩', '🧠', '👀'
  ];

  // 📜 Der epische, lustige Rollen-Pool
  public readonly ROLES_POOL = [
    'Lead Developer 💻', 'Frontend Zauberer 🧙‍♂️', 'Backend Architekt 🏗️', 
    'Bug Hunter 🦟', 'Kaffee-Beauftragter ☕', 'Master of Deployments 🚀',
    'Scrum Guru 🧘‍♂️', 'Quality Assurance Experte 🧪', 'Database Whisperer 💾',
    'CSS Ninja 🥷', 'Pipeline Mastermind ⛓️', 'Git Konflikt Löser 🛠️',
    'UI/UX Alchemist 🎨', 'Dark Mode Enthusiast 🌙', 'StackOverflow Copy-Paster 📋',
    'Code Review Sheriff 🤠'
  ];

  ngOnInit(): void {
    this.sub = this.teamService.getSortedMembers$(null).subscribe({
      next: (data) => {
        this.members.set(data);
      },
      error: (err) => console.error("❌ Fehler beim Laden:", err)
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  public startEditing(member: UserModel): void {
    this.editingUserId.set(member.id);
    this.tempRole = member.role;
    this.tempEmoji = member.emoji;
  }

  public cancelEditing(): void {
    this.editingUserId.set(null);
  }

  public saveProfile(member: UserModel): void {
    if (!this.tempRole.trim()) this.tempRole = 'Teammitglied';
    this.teamService.updateCoffeeAccount(member.id, member.coffeeBalance, this.tempRole, this.tempEmoji);
    this.editingUserId.set(null);
  }

  public isMemberGesperrt(member: UserModel): boolean {
    if (!member || !member.id) return false;
    return member.coffeeBalance <= -5.00;
  }

  public getMemberStatusText(member: UserModel): string {
    return this.isMemberGesperrt(member) ? 'Gesperrt ❌' : 'Aktiv  ';
  }

  public onDrinkCoffee(member: UserModel): void {
    if (this.isMemberGesperrt(member)) return;
    const newBalance = member.coffeeBalance - 1.00; 
    this.teamService.updateCoffeeAccount(member.id, newBalance, member.role, member.emoji);
  }

  public onAddMoney(member: UserModel): void {
    const newBalance = member.coffeeBalance + 5.00; 
    this.teamService.updateCoffeeAccount(member.id, newBalance, member.role, member.emoji);
  }
}