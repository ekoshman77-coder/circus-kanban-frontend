import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

import { CentralQueueService } from './central-queue-service';
import { LocalStorageService } from '../user/local-storage-service';
import { AUTH_CONTEXT, IAuthContext } from '../user/auth-context';
import { LaborCentralQueueService } from './labor-central-queue-service';
import { TestBed } from '@angular/core/testing';
import { mockLocalStorageService } from '@tests/helpers/test-providers';

describe('CentralQueueService (Facade)', () => {
    let facadeService: CentralQueueService;
    let mockAuthContext: Partial<IAuthContext>;

    beforeEach(() => {
        vi.spyOn(mockLocalStorageService, 'getItem').mockImplementation((key: string) => {
            if (key === 'global_labor_mode_active') {
                return true;
            }
            return null;
        });

        mockAuthContext = {
            getCurrentUserId: vi.fn().mockReturnValue('user-123'),
            isLoggedIn: vi.fn().mockReturnValue(true)
        };

        TestBed.configureTestingModule({
            providers: [
                CentralQueueService,
                { provide: LocalStorageService, useValue: mockLocalStorageService },
                { provide: AUTH_CONTEXT, useValue: mockAuthContext },
            ]
        });

        facadeService = TestBed.inject(CentralQueueService);
    });

    it('sollte bootstrapLiveAndSealLabor direkt im Labor-Modus starten und fetchInitialDataForLabor aufrufen', () => {
        const laborInstance = (facadeService as any).activeServiceInstance as LaborCentralQueueService;
        const fetchSpy = vi.spyOn(laborInstance, 'fetchInitialDataForLabor').mockReturnValue(of(true));

        let bootstrapped = false;
        facadeService.bootstrapLiveAndSealLabor().subscribe(() => {
            bootstrapped = true;
        });

        expect(facadeService.isLaborMode()).toBe(true);
        expect(fetchSpy).toHaveBeenCalledWith('user-123');
        expect(bootstrapped).toBe(true);
    });
});