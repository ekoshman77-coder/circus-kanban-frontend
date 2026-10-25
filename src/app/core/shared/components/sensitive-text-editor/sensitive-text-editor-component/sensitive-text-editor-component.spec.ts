import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SensitiveTextEditorComponent } from './sensitive-text-editor-component';

describe('SensitiveTextEditorComponent', () => {
  let component: SensitiveTextEditorComponent;
  let fixture: ComponentFixture<SensitiveTextEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SensitiveTextEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SensitiveTextEditorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
