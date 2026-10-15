import { QueueItem } from '../models/queue-items/queue-item';
import { DraftChainDto, DraftOrigin } from '../repositories/dto/draft-chain-dto';
import { DelegationTarget } from './queue-items/draft-queue-payload';
import { DomainModel } from './domain-model';

export interface DraftChainItem {
  queueItem: QueueItem;
  isRootCause: boolean;       // true = Das Element, das den Abbruch verursacht hat
}

export interface DraftChainParams {
  id?: string;
  title: string;
  items: DraftChainItem[];
  createdAt?: number;
  origin: DraftOrigin;
  createdByUserId?: string;
  lastErrorReason?: string;
  lastErrorCode?: number;
  target?: DelegationTarget;
  delegatedByUserId?: string;
  note?: string;
}

export class DraftChain implements DomainModel<DraftChain> {
  public id: string;
  public title: string;
  public items: DraftChainItem[];
  public createdAt: number;
  public origin: DraftOrigin;
  public createdByUserId: string;
  public lastErrorReason: string;
  public lastErrorCode: number;
  public target?: DelegationTarget;
  public delegatedByUserId?: string;
  public note?: string;

  constructor(params: DraftChainParams) {
    this.id = params.id ?? `draft_${params.origin.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.title = params.title;
    this.items = params.items;
    this.createdAt = params.createdAt ?? Date.now();
    this.origin = params.origin;
    this.createdByUserId = params.createdByUserId ?? '';
    this.lastErrorReason = params.lastErrorReason ?? '';
    this.lastErrorCode = params.lastErrorCode ?? 0;
    this.target = params.target;
    this.delegatedByUserId = params.delegatedByUserId;
    this.note = params.note;
  }

  public cloneWith(changes: Partial<DraftChainParams>): DraftChain {
    return new DraftChain({
      id: changes.id ?? this.id,
      title: changes.title ?? this.title,
      items: changes.items ?? this.items,
      createdAt: changes.createdAt ?? this.createdAt,
      origin: changes.origin ?? this.origin,
      createdByUserId: changes.createdByUserId ?? this.createdByUserId,
      lastErrorReason: changes.lastErrorReason ?? this.lastErrorReason,
      lastErrorCode: changes.lastErrorCode ?? this.lastErrorCode,
      target: changes.target !== undefined ? changes.target : this.target,
      delegatedByUserId: changes.delegatedByUserId !== undefined ? changes.delegatedByUserId : this.delegatedByUserId,
      note: changes.note !== undefined ? changes.note : this.note
    });
  }

  public toJson(): DraftChainDto {
    return {
      id: this.id,
      title: this.title,
      items: structuredClone(this.items),
      createdAt: this.createdAt,
      createdByUserId: this.createdByUserId,
      target: this.target,
      delegatedByUserId: this.delegatedByUserId,
      note: this.note,
      lastErrorReason: this.lastErrorReason,
      lastErrorCode: this.lastErrorCode,
      origin: this.origin
    };
  }

  public static fromJson(dto: DraftChainDto): DraftChain {
    return new DraftChain({
      id: dto.id,
      title: dto.title || 'Unbenannter Entwurf',
      items: dto.items || [],
      createdAt: dto.createdAt || Date.now(),
      origin: dto.origin ?? 'REMOTE',
      createdByUserId: dto.createdByUserId || '',
      lastErrorReason: dto.lastErrorReason || '',
      lastErrorCode: dto.lastErrorCode ?? 0,
      target: dto.target,
      delegatedByUserId: dto.delegatedByUserId,
      note: dto.note
    });
  }
}