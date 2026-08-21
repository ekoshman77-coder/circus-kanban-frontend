import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { MasterDataRepository } from "../../repositories/master-data-repository";
import { MasterDataDto } from "../../repositories/dto/master-data-dto";
import { ConnectionService } from "../connection/connection-service";
import { LocalStorageService } from "../user/local-storage-service";

@Injectable({
  providedIn: 'root'
})
export class MasterDataService {
    private masterDataRepository: MasterDataRepository = inject(MasterDataRepository)
    private connectionService = inject(ConnectionService)
    private localStorageService = inject(LocalStorageService)

    private masterData = signal<MasterDataDto | null>(null)
    
    public departmentScopes = computed(() => this.masterData()?.departmentScopes?? [])

    public departmentRoles = computed(() => this.masterData()?.departmentRoles?? [])
 
    public projectRoles = computed(() => this.masterData()?.projectRoles?? [])

    private STORAGE_KEY = "MASTER_DATA"

    private lastLoaded: number = 0;
    private CACHE_DURATION = 5 * 60 * 1000; // Nur alle 5 Minuten neu laden
    
    constructor() {
        effect(() => {
            if (this.connectionService.isOnline()) {
                this.loadMasterData()
            }
        })
    }

    private loadMasterData() {
        if (this.masterData()) {
            return
        }
        
        const now = Date.now()
        if (now - this.lastLoaded < this.CACHE_DURATION) {
            return
        }
        console.log("DEPARTMENTSERVICE Load data")
        this.masterDataRepository.getMasterData().subscribe({
            next: (data) => {
                this.lastLoaded = now
                console.log("MasterDataService master data: ", data)
                this.masterData.set(data)
                this.localStorageService.setItem(this.STORAGE_KEY, data)
           },
            error: (err) => {
                console.log("MasterDataService Fehler beim holen master data", err)
                if (!this.masterData()) {
                    this.masterData.set(this.localStorageService.getItem(this.STORAGE_KEY))
                }
            }
        })        
    }
}
