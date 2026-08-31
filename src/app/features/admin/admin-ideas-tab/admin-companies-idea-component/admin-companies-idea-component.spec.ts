import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCompaniesIdeaComponent } from './admin-companies-idea-component';

describe('AdminCompaniesIdeaComponent', () => {
  let component: AdminCompaniesIdeaComponent;
  let fixture: ComponentFixture<AdminCompaniesIdeaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCompaniesIdeaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCompaniesIdeaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
