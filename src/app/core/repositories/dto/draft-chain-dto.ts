import { DraftChainItem } from "../../models/draft-chain";
import { DelegationTarget } from "../../models/queue-items/draft-queue-payload";

export type DraftOrigin = 'LOCAL' | 'REMOTE';

export interface DraftChainDto {
  id: string;
  title: string;
  target?: DelegationTarget;
  createdAt: number;
  assignedTo?: string;
  createdByUserId: string;
  delegatedByUserId?: string;
  note?: string;
  lastErrorReason: string;
  lastErrorCode: number;
  items: DraftChainItem[];
  origin?: DraftOrigin
}

export interface DelegateDraftDto extends DraftChainDto {
  target: DelegationTarget; // Pflichtfeld beim Senden per POST
}