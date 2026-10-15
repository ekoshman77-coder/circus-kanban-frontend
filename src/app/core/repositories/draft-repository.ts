import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DraftUrl } from './links';
import { DelegateDraftDto, DraftChainDto } from './dto/draft-chain-dto';

@Injectable({
  providedIn: 'root'
})
export class DraftRepository {
  private http = inject(HttpClient);

  /** Holt alle Entwürfe für den aktuellen User */
  public fetchAssignedDrafts(): Observable<DraftChainDto[]> {
    return this.http.get<DraftChainDto[]>(DraftUrl);
  }

  /** Delegiert den Entwurf {chainId} */
  public delegateDraft(dto: DelegateDraftDto): Observable<void> {
    console.log("Repository :: delegateDraft", dto)
    const chainId = dto.id
    return this.http.post<void>(`${DraftUrl}/${chainId}/delegate`, dto);
  }

  /** Löscht den Entwurf auf dem Server */
  public deleteServerDraft(chainId: string): Observable<void> {
    return this.http.delete<void>(`${DraftUrl}/${chainId}`);
  }
}