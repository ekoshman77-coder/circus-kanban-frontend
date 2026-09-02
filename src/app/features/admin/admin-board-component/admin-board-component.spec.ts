import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminBoardComponent } from './admin-board-component';
import { setupLocalStorageMock } from '../../../core/shared/test-utils/local-storage-mock';

setupLocalStorageMock();

describe('AdminBoardComponent', () => {
  let component: AdminBoardComponent;
  let fixture: ComponentFixture<AdminBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminBoardComponent]
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
