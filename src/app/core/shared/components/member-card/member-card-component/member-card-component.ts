import { Component, input, output } from '@angular/core';
import { ProjectRole, UserModel } from '../../../../models/user-model'; 
import { UserSummary } from '../../../../models/user-summary';

@Component({
  selector: 'app-member-card-component',
  standalone: true,
  imports: [],
  templateUrl: './member-card-component.html',
  styleUrl: './member-card-component.css',
})
export class MemberCardComponent {
  public user = input.required<UserModel | UserSummary>();
  public actionType = input<'add' | 'remove'>('add'); 
  public role = input<ProjectRole | string | null>(null);

  public actionClicked = output<void>();
  public badgeClicked = output<void>();

  public onButtonClick(): void {
    this.actionClicked.emit();
  }

  public onBadgeClicked(): void {
    this.badgeClicked.emit()
  }
}