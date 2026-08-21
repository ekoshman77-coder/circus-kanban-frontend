import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepartmetSelectModal } from './departmet-select-modal';

describe('DepartmetSelectModal', () => {
  let component: DepartmetSelectModal;
  let fixture: ComponentFixture<DepartmetSelectModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepartmetSelectModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepartmetSelectModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
