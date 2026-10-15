import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { InviteRequestDto, SearchUserDto } from "./dto/inivitation-dto";
import { InvitationUrl } from "./links";
import { IDepartment } from "./dto/deparment-json";

@Injectable({
  providedIn: 'root',
})
export class InvitationRepository{
    private http = inject(HttpClient);

    public getDepartmentsForInvitation(): Observable<IDepartment[]> {
        return this.http.get<IDepartment[]>(`${InvitationUrl}/departments`); 
    }

    // 2. URL übergeben + Rückgabetyp auf Array (SearchUserDto[]) geändert
    public getUsersForInvitation(payload: InviteRequestDto): Observable<SearchUserDto[]> {
        return this.http.post<SearchUserDto[]>(`${InvitationUrl}/search-users`, payload);
    }
}
