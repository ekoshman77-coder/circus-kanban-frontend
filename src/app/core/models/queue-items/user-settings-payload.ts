import { SnapshotPayload } from './queue-item';
import { PlannerSettingsDto } from '../../repositories/user-repository';

// UserSettings nutzen PlannerSettingsDto als Snapshot-Typ
export interface UserSettingsPayload extends SnapshotPayload< PlannerSettingsDto> {
  userId: string;
  settings: PlannerSettingsDto;
}