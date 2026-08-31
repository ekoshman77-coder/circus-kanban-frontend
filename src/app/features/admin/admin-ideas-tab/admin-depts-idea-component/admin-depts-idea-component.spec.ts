import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDeptsIdeaComponent } from './admin-depts-idea-component';

describe('AdminDeptsIdeaComponent', () => {
  let component: AdminDeptsIdeaComponent;
  let fixture: ComponentFixture<AdminDeptsIdeaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDeptsIdeaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDeptsIdeaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
