import { ComponentFixture, TestBed } from '@angular/core/testing';
import { setupLocalStorageMock } from '../../../../core/shared/test-utils/local-storage-mock';
import { AdminIdeasTabComponent } from './admin-ideas-tab-component';

setupLocalStorageMock();

describe('AdminIdeasTabComponent', () => {
  let component: AdminIdeasTabComponent;
  let fixture: ComponentFixture<AdminIdeasTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminIdeasTabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminIdeasTabComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
