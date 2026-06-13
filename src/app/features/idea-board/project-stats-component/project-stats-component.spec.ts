import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectStatsComponent } from './project-stats-component';

describe('ProjectStatsComponent', () => {
  let component: ProjectStatsComponent;
  let fixture: ComponentFixture<ProjectStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectStatsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
