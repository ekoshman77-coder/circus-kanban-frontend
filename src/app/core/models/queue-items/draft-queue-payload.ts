import { DraftChainDto } from "../../repositories/dto/draft-chain-dto";
import { DraftChain } from "../draft-chain";
import { QueueItem, SnapshotPayload } from "./queue-item";

export type DelegationTargetType = 'DEPARTMENT' | 'ADMINS' | 'PROJECT' | 'USER';

export type DraftQueueActions = 'SAVE_DRAFT_CHAIN' | 'REMOVE_DRAFT_CHAIN' | 'SYNC_REMOTE_DRAFTS'

export interface DelegationTarget {
  type: DelegationTargetType; 
  id: string; // z. B. 'dept_marketing', 'proj_24', 'user_123' oder bei ADMINS z. B. 'global_admins'
}

export interface DelegateDraftPayload extends SnapshotPayload {
  draftChain: DraftChain
}

export interface DeleteDraftPayload extends SnapshotPayload {

}