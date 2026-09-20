import { PlannerSettingsDto } from '../../repositories/dto/planner-settings-dto';
import { SnapshotPayload } from './queue-item';

// UserSettings nutzen PlannerSettingsDto als Snapshot-Typ
export interface UserSettingsPayload extends SnapshotPayload< PlannerSettingsDto> {
  userId: string;
  settings: PlannerSettingsDto;
}