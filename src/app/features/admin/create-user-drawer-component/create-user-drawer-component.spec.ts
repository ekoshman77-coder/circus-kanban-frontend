import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateUserDrawerComponent } from './create-user-drawer-component';
import { setupLocalStorageMock } from '../../../core/shared/test-utils/local-storage-mock';

setupLocalStorageMock();

describe('CreateUserDrawerComponent', () => {
  let component: CreateUserDrawerComponent;
  let fixture: ComponentFixture<CreateUserDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateUserDrawerComponent]
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
