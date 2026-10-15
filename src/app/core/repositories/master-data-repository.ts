import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { MasterDataDto } from "./dto/master-data-dto";
import { MasterDataUrl } from "./links";

@Injectable({
  providedIn: 'root',
})
export class MasterDataRepository{
    private http = inject(HttpClient);

    public getMasterData(): Observable<MasterDataDto>{
        return this.http.get<MasterDataDto>(MasterDataUrl)
    }
}