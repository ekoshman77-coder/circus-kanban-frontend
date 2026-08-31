import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminIdeasTabComponent } from './admin-ideas-tab-component';

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
