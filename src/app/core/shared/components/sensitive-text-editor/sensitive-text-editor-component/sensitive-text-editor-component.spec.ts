import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SensitiveTextEditorComponent } from './sensitive-text-editor-component';
import { MasterDataService } from '../../../../services/admin/master-data-service';
import { SanitizationService } from '../../../../services/ai/sanitization/sanitization-service';
import { UniversalPredictorService } from '../../../../services/ai/universal-predictor-service';
import { UserService } from '../../../../services/user/user-service';
import { NotificationService } from '../../../../services/notification/notification-service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';

describe('SensitiveTextEditorComponent', () => {
  let component: SensitiveTextEditorComponent;
  let fixture: ComponentFixture<SensitiveTextEditorComponent>;

  beforeEach(async () => {
    // Mocks für die Services erstellen, damit keine echten HTTP-/Queue-Aufrufe oder Auth-Token gesucht werden
    const masterDataServiceMock = {
      patternTypes: signal([])
    };
    const sanitizationServiceMock = {};
    const universalPredictorServiceMock = {};
    const userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-1')
    };
    const notificationServiceMock = {
      showNotification: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [SensitiveTextEditorComponent],
      providers: [
        { provide: MasterDataService, useValue: masterDataServiceMock },
        { provide: SanitizationService, useValue: sanitizationServiceMock },
        { provide: UniversalPredictorService, useValue: universalPredictorServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SensitiveTextEditorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});