import { TodoSnapshotPayload } from "./todo-queue-payload";

// 1. Tracking eines einzelnen ausgewählten Milestones
export interface TrackMilestonePayload extends TodoSnapshotPayload {
  projectTitle: string;
  projectArea: string;
  milestoneTitle: string;
  userId: string;
}

// 2. Tracking von ignorierten Milestones (Bulk-Kette)
export interface TrackMilestoneIgnorancePayload extends TodoSnapshotPayload {
  projectTitle: string;
  projectArea: string;
  milestoneTitles: string[];
  userId: string;
}