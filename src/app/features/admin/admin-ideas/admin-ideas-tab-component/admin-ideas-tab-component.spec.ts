import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { setupLocalStorageMock } from '../../../../../../tests/helpers/local-storage-mock';
import { AdminIdeasTabComponent } from './admin-ideas-tab-component';
import { IdeaBoardComponent, BoardMode } from '../../../idea-board/idea-board-component/idea-board-component';

// 🟢 Stub-Komponente für die verschachtelte IdeaBoardComponent erzeugen:
@Component({
  selector: 'app-idea-board',
  standalone: true,
  template: ''
})
class MockIdeaBoardComponent {
  @Input() mode!: BoardMode;
}

setupLocalStorageMock();

describe('AdminIdeasTabComponent', () => {
  let component: AdminIdeasTabComponent;
  let fixture: ComponentFixture< AdminIdeasTabComponent >;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminIdeasTabComponent]
    })
    // 🟢 Wir ersetzen die echte IdeaBoardComponent durch unser Mock-Objekt:
    .overrideComponent(AdminIdeasTabComponent, {
      remove: { imports: [IdeaBoardComponent] },
      add: { imports: [MockIdeaBoardComponent] }
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