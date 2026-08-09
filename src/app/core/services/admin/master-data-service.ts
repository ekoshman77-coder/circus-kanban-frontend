import { computed, inject, Injectable, signal } from "@angular/core";
import { MasterDataRepository } from "../../repositories/master-data-repository";
import { MasterDataDto } from "../../repositories/dto/master-data-dto";

@Injectable({
  providedIn: 'root'
})
export class MasterDataService {
    private masterDataRepository: MasterDataRepository = inject(MasterDataRepository)
    private masterData = signal<MasterDataDto | null>(null)
    public departmentScopes = computed(() => this.masterData()?.departmentScopes?? [])

    public departmentRoles = computed(() => this.masterData()?.departmentRoles?? [])
 
    public projectRoles = computed(() => this.masterData()?.projectRoles?? [])

    public loadMasterData() {
        console.log("DEPARTMENTSERVICE Load data")
        this.masterDataRepository.getMasterData().subscribe({
            next: (data) => {
                console.log("DEPARTMENTSERVICE master data: ", data)
                this.masterData.set(data)
            },
            error: (err) => {
                console.log("DEPARTMENTSERVICE Fehler beim holen master data", err)
            }
        })        
    }
}
