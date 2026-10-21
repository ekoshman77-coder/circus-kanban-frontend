import { generateLocalId } from "../shared/constants/id-const";
import { DomainModel } from "./domain-model";

export type MatchSource = 'SERVER_HEURISTIC' | 'AI_MODEL' | 'ADMIN_MANUAL';

export interface ISensitiveMatchInit {
  id?: string;
  startIndex: number;
  endIndex: number;
  patternId: string;
  reason: string;
  isApproved?: boolean | null;
  source?: MatchSource;
}

export class SensitiveMatch implements DomainModel<SensitiveMatch> {
  id: string;
  startIndex: number;
  endIndex: number;
  patternId: string;
  reason: string;
  isApproved: boolean | null;
  source: MatchSource;

  constructor(data: ISensitiveMatchInit) {
    this.id = data.id || generateLocalId();
    this.startIndex = data.startIndex;
    this.endIndex = data.endIndex;
    this.patternId = data.patternId;
    this.reason = data.reason || 'UNKNOWN';
    this.isApproved = data.isApproved?? null;
    this.source = data.source || 'SERVER_HEURISTIC';
  }

   public cloneWith(changes: Partial<SensitiveMatch>): SensitiveMatch {
        return new SensitiveMatch({
            id: changes.id?? this.id,
            startIndex: changes.startIndex?? this.startIndex,
            endIndex: changes.endIndex?? this.endIndex,
            patternId: changes.patternId?? this.patternId,
            reason: changes.reason?? this.reason,
            isApproved: (changes.isApproved == null || !!changes.isApproved) ?  changes.isApproved?? null : this.isApproved,
            source: changes.source ?? this.source
        })
    }

  public static fromJson(json: ISensitiveMatchInit): SensitiveMatch {
    return new SensitiveMatch({
      id: json.id,
      startIndex: json.startIndex,
      endIndex: json.endIndex,
      patternId: json.patternId,
      reason: json.reason,
      isApproved: json.isApproved,
      source: json.source || 'SERVER_HEURISTIC'
    });
  }

  public toJson(): ISensitiveMatchInit {
    return {
      id: this.id,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      patternId: this.patternId,
      reason: this.reason,
      isApproved: this.isApproved?? undefined,
      source: this.source
    };
  }
}