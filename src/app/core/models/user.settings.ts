import { DomainModel } from "./domain-model";

export type UserEnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export class UserSettings implements DomainModel< UserSettings > {
  constructor(
    public userId: string,
    public defaultWorkingHours: number = 8,
    public primeTimeStartHour: number = 10,
    public primeTimeEndHour: number = 18,
    public workingTimeLeft: number = 8,
    public userEnergy: UserEnergyLevel = 'MEDIUM'
  ) {}

  public get id(): string {
    return this.userId;
  }

  public toJson(): Record<string, any> {
    return {
      userId: this.userId,
      defaultWorkingHours: this.defaultWorkingHours,
      primeTimeStartHour: this.primeTimeStartHour,
      primeTimeEndHour: this.primeTimeEndHour,
      workingTimeLeft: this.workingTimeLeft,
      userEnergy: this.userEnergy,
    };
  }

  public static fromJson(json: any): UserSettings {
    if (!json) {
      return new UserSettings('');
    }

    return new UserSettings(
      json.userId ?? '',
      json.defaultWorkingHours ?? 8,
      json.primeTimeStartHour ?? 10,
      json.primeTimeEndHour ?? 18,
      json.workingTimeLeft ?? 8,
      json.userEnergy ?? 'MEDIUM'
    );
  }

  public cloneWith(changes: Partial< UserSettings >): UserSettings {
    return new UserSettings(
      changes.userId ?? this.userId,
      changes.defaultWorkingHours ?? this.defaultWorkingHours,
      changes.primeTimeStartHour ?? this.primeTimeStartHour,
      changes.primeTimeEndHour ?? this.primeTimeEndHour,
      changes.workingTimeLeft ?? this.workingTimeLeft,
      changes.userEnergy ?? this.userEnergy
    );
  }
}