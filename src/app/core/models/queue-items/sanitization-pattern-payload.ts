import { SnapshotPayload } from "./queue-item";

export type SanitizationQueueAction = 'CREATE_PATTERN';

export interface CreatePatternPayload extends SnapshotPayload {
  selectedText: string;
  patternType: string;
  reason: string;
}