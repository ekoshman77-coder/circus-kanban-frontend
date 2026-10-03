import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminBoardComponent } from './admin-board-component';
import { setupLocalStorageMock } from '../../../../../tests/helpers/local-storage-mock';
import { DepartmentTabComponent } from '../departments-component/departments-component';
import { AdminUsersComponent } from '../admin-users-component/admin-users-component';
import { PermissionsComponent } from '../permissions-component/permissions-component';
import { AdminIdeasTabComponent } from '../admin-ideas/admin-ideas-tab-component/admin-ideas-tab-component';
import { Component } from '@angular/core';

// Dummy-Komponenten als Ersatz
@Component({ selector: 'app-departments-component', standalone: true, template: '' })
class MockDepartmentTabComponent {}

@Component({ selector: 'app-admin-users-component', standalone: true, template: '' })
class MockAdminUsersComponent {}

@Component({ selector: 'app-permissions-component', standalone: true, template: '' })
class MockPermissionsComponent {}

@Component({ selector: 'app-admin-ideas-tab-component', standalone: true, template: '' })
class MockAdminIdeasTabComponent {}

setupLocalStorageMock();

describe('AdminBoardComponent', () => {
  let component: AdminBoardComponent;
  let fixture: ComponentFixture<AdminBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminBoardComponent]
    })
    // 🟢 Echte Kindkomponenten durch leere Mocks ersetzen:
    .overrideComponent(AdminBoardComponent, {
      remove: {
        imports: [
          DepartmentTabComponent,
          AdminUsersComponent,
          PermissionsComponent,
          AdminIdeasTabComponent
        ]
      },
      add: {
        imports: [
          MockDepartmentTabComponent,
          MockAdminUsersComponent,
          MockPermissionsComponent,
          MockAdminIdeasTabComponent
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminBoardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});