import { QueueItem } from '../models/queue-items/queue-item';
import { DraftChainDto, DraftOrigin } from '../repositories/dto/draft-chain-dto';
import { DelegationTarget } from './queue-items/draft-queue-payload';
import { Serializable } from './serialisable-interface';

export interface DraftChainItem {
  queueItem: QueueItem;
  isRootCause: boolean;       // true = Das Element, das den Abbruch verursacht hat
}

export class DraftChain implements Serializable< DraftChainDto > {
  constructor(
    public id: string,
    public title: string,
    public items: DraftChainItem[],
    public createdAt: number,
    public origin: DraftOrigin,
    public createdByUserId: string,
    public lastErrorReason: string,
    public lastErrorCode: number,
    public target?: DelegationTarget,
    public delegatedByUserId?: string,
    public note?: string
  ) {}

  public toJson(): DraftChainDto {
    return {
      id: this.id,
      title: this.title,
      items: structuredClone(this.items),
      createdAt: this.createdAt?? Date.now(),
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
    return new DraftChain(
      dto.id,
      dto.title || 'Unbenannter Entwurf',
      dto.items || [],
      dto.createdAt || Date.now(),
      dto.origin?? "REMOTE",
      dto.createdByUserId || '',
      dto.lastErrorReason || '',
      dto.lastErrorCode || 500,
      dto.target,
      dto.delegatedByUserId,
      dto.note
    );
  }
}