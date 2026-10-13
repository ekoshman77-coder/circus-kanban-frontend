import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BatchPermissionModalComponent } from './batch-permission-modal-component';
import { MasterDataService } from '../../../../core/services/admin/master-data-service';
import { PermissionService } from '../../../../core/services/permissions/permission-service';
import { AUTH_CONTEXT, IAuthContext } from '../../../../core/services/user/auth-context';

describe('BatchPermissionModalComponent', () => {
  let component: BatchPermissionModalComponent;
  let fixture: ComponentFixture< BatchPermissionModalComponent >;

  let mockMasterDataService: Partial< MasterDataService >;
  let mockPermissionService: Partial< PermissionService >;
  let mockAuthContext: Partial< IAuthContext >;

  beforeEach(async () => {
    // Exakte Nachbildung der computed Signals aus MasterDataService
    mockMasterDataService = {
      departmentScopes: signal< string[] >(['DEPT_A', 'DEPT_B']),
      allScopes: signal< string[] >(['GLOBAL', 'DEPARTMENT']),
      departmentRoles: signal< string[] >(['ROLE_DEPT_HEAD']),
      projectRoles: signal< string[] >(['ROLE_PROJECT_LEAD']),
      otherRoles: signal< string[] >(['ROLE_GUEST']),
      allRoles: signal< string[] >(['ROLE_ADMIN', 'ROLE_USER']),
      resources: signal< string[] >(['TODO', 'NOTE', 'USER']),
      actions: signal< string[] >(['READ', 'WRITE', 'DELETE']),
      specializations: signal< string[] >(['IT', 'HR'])
    };

    mockPermissionService = {
      batchCreatePermission: vi.fn()
    };

    mockAuthContext = {
      isLoggedIn: vi.fn().mockReturnValue(true),
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    await TestBed.configureTestingModule({
      imports: [BatchPermissionModalComponent],
      providers: [
        { provide: MasterDataService, useValue: mockMasterDataService },
        { provide: PermissionService, useValue: mockPermissionService },
        { provide: AUTH_CONTEXT, useValue: mockAuthContext }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BatchPermissionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});