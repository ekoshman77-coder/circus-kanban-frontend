import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BatchPermissionModalComponent } from './batch-permission-modal-component';

describe('BatchPermissionModalComponent', () => {
  let component: BatchPermissionModalComponent;
  let fixture: ComponentFixture<BatchPermissionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BatchPermissionModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BatchPermissionModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
