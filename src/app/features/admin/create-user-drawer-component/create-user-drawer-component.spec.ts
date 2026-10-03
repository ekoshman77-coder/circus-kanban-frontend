import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateUserDrawerComponent } from './create-user-drawer-component';
import { setupLocalStorageMock } from '../../../../../tests/helpers/local-storage-mock';
import { TeamService } from '../../../core/services/team/team-service';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { vi } from 'vitest';

setupLocalStorageMock();

describe('CreateUserDrawerComponent', () => {
  let component: CreateUserDrawerComponent;
  let fixture: ComponentFixture<CreateUserDrawerComponent>;

  // 1. Mocks für die benötigten Services definieren
  const mockTeamService = {
    createMember: vi.fn()
  };

  const mockNotificationService = {
    showNotification: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateUserDrawerComponent],
      providers: [
        // 2. Mocks im TestBed registrieren
        { provide: TeamService, useValue: mockTeamService },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateUserDrawerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});