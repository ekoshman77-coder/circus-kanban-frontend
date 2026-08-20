import { SearchUserDto } from "../repositories/dto/inivitation-dto"
import { UserModel } from "./user-model"

export class UserSummary {
  id: string
  firstName: string
  lastName: string
  constructor(init: { id: string, firstName: string, lastName: string }) {
    this.id = init.id
    this.firstName = init.firstName
    this.lastName = init.lastName
  }

  static fromJson(userDto: SearchUserDto): UserSummary {
    return new UserSummary({
      id: userDto.id ?? '',
      firstName: userDto.firstName ?? '',
      lastName: userDto.lastName ?? ''
    });
  }

  static fromUserModel(user: UserModel) {
    return new UserSummary({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName
    })
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  getInitials(): string {
    const first = this.firstName.charAt(0) || '';
    const last = this.lastName.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  }

  getColorHash(): string {
    if (!this.fullName) return '#cbd5e1';
    let hash = 0;
    for (let i = 0; i < this.fullName.length; i++) {
      hash = (hash * 31) + this.fullName.charCodeAt(i);
      hash = (hash << 5) - hash + (this.fullName.charCodeAt(i) * 12345);
    }
    const spreadValue = Math.abs(hash * 777);
    const h = spreadValue % 360;
    return `hsl(${h}, 70%, 75%)`;
  }

  public createPendingUser(): UserModel {
    return new UserModel({
      id: this.id,
      username: "",
      firstName: this.firstName,
      lastName: this.lastName,
      department: null,
      departmentRole: "",
      isApproved: true,
      projectIds: [],
      coffeeAccount: {
        balance: 0,
        role: "",
        emoji: ""
      }
    })
  }

}