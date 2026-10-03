import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditModalComponent } from './edit-modal-component';
import { PayloadFormVisitor } from '../../payload-form-visior';
import { DraftChain, DraftChainItem } from '../../../../core/models/draft-chain';
import { DraftOrigin } from '../../../../core/repositories/dto/draft-chain-dto';
import { DelegationTarget } from '../../../../core/models/queue-items/draft-queue-payload';
import { QueueHandlerName } from '../../../../core/enums/queue-handler-name';
import { FormGroup, FormControl } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('EditModalComponent', () => {
  let component: EditModalComponent;
  let fixture: ComponentFixture< EditModalComponent >;
  let mockPayloadFormVisitor: Partial< PayloadFormVisitor >;

  // Mock-Daten für die DraftChain
  const mockRootItem: DraftChainItem = {
    queueItem: {
      id: 'item-1',
      serviceName: QueueHandlerName.TODO,
      action: 'CREATE_TODO',
      payload: {
        id: 'todo-1',
        displayInfo: {
          category: 'To-Do',
          title: 'Test-Aufgabe'
        }
      },
      timestamp: Date.now()
    },
    isRootCause: true
  };

  const mockOrigin: DraftOrigin = 'LOCAL';
  const mockTarget: DelegationTarget = {
    type: 'USER',
    id: 'user_123'
  };

  const mockChain = new DraftChain(
    'chain-1',
    'Test Chain',
    [mockRootItem],
    Date.now(),
    mockOrigin,
    'user-1',
    'Error Reason',
    500,
    mockTarget
  );

  beforeEach(async () => {
    mockPayloadFormVisitor = {
      createForm: vi.fn().mockReturnValue(
        new FormGroup({
          task: new FormControl('Test-Aufgabe')
        })
      )
    };

    await TestBed.configureTestingModule({
      imports: [EditModalComponent],
      providers: [
        { provide: PayloadFormVisitor, useValue: mockPayloadFormVisitor }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditModalComponent);
    component = fixture.componentInstance;

    // ⚡ Erforderlichen Input setzen, BEVOR changeDetection getriggert wird!
    fixture.componentRef.setInput('chain', mockChain);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});