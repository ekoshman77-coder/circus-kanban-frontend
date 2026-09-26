import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { QueueItem, SnapshotPayload } from '../../core/models/queue-items/queue-item';
import { QueueHandlerName } from '../../core/enums/queue-handler-name';
import { CreateMemberPayload, ProfilePayload } from '../../core/models/queue-items/member-queue-payload';
import { NotePayload } from '../../core/models/queue-items/note-queue-payload';
import { DepartmentPayload } from '../../core/models/queue-items/department-queue-payload';
import { ProjectPayload } from '../../core/models/queue-items/project-queue-item';
import { TodoPayload } from '../../core/models/queue-items/todo-queue-payload';

@Injectable({ providedIn: 'root' })
export class PayloadFormVisitor {
  private fb = inject(FormBuilder);

  public createForm(item: QueueItem): FormGroup {
    const { serviceName, action, payload } = item;

    switch (serviceName) {
      case QueueHandlerName.DEPARTMENT:
        return this.handleDepartmentService(action, payload);

      case QueueHandlerName.TEAM:
        return this.handleTeamService(action, payload);

      case QueueHandlerName.NOTE:
        return this.handleNoteService(action, payload);

      case QueueHandlerName.PROJECT:
        return this.handleProjectService(action, payload);

      case QueueHandlerName.TODO:
        return this.handleTodoService(action, payload);

      // Services ohne korrigierbare Formularfelder:
      case QueueHandlerName.PERMISSION:
      case QueueHandlerName.PLANNER:
      case QueueHandlerName.FOCUS:
      case QueueHandlerName.USER_SETTINGS:
      case QueueHandlerName.ADMIN_TEAM:
        return this.visitNonEditable('Diese Aktion enthält keine manuell anpassbaren Formularfelder.');

      default:
        return this.visitGeneric(payload);
    }
  }

  // --- SERVICE HANDLER ---

  private handleDepartmentService(action: string, payload: any): FormGroup {
    switch (action) {
      case 'CREATE':
      case 'UPDATE':
        return this.visitDepartment(payload as DepartmentPayload);
      default:
        return this.visitNonEditable('Department-Aktion ist nicht manuell editierbar.');
    }
  }

  private handleTeamService(action: string, payload: any): FormGroup {
    switch (action) {
      case 'CREATE_MEMBER':
        return this.visitCreateMember(payload as CreateMemberPayload);
      case 'UPDATE_PROFILE':
        return this.visitProfile(payload as ProfilePayload);
      default:
        return this.visitNonEditable('Team-Aktion enthält keine anpassbaren Felder.');
    }
  }

  private handleNoteService(action: string, payload: any): FormGroup {
    switch (action) {
      case 'CREATE':
      case 'UPDATE':
        return this.visitNote(payload as NotePayload);
      default:
        return this.visitNonEditable('Notiz-Aktion enthält keine anpassbaren Felder.');
    }
  }

  private handleProjectService(action: string, payload: any): FormGroup {
    switch (action) {
      case 'CREATE':
      case 'UPDATE':
        return this.visitProject(payload as ProjectPayload);
      default:
        return this.visitNonEditable('Projekt-Aktion enthält keine anpassbaren Felder.');
    }
  }

  private handleTodoService(action: string, payload: any): FormGroup {
    switch (action) {
      case 'CREATE':
      case 'UPDATE':
        return this.visitTodo(payload as TodoPayload);
      default:
        return this.visitNonEditable('Todo-Aktion enthält keine anpassbaren Felder.');
    }
  }

  // --- SLIM FORM BUILDER METHODEN ---

  private visitDepartment(payload: DepartmentPayload): FormGroup {
    const dept = payload?.department;
    return this.fb.group({
      name: [dept?.name || '', [Validators.required, Validators.minLength(2)]]
    });
  }

  private visitCreateMember(payload: CreateMemberPayload): FormGroup {
    return this.fb.group({
      username: [payload?.username || '', [Validators.required, Validators.minLength(3)]]
    });
  }

  private visitProfile(payload: ProfilePayload): FormGroup {
    return this.fb.group({
      username: [payload?.username || '', [Validators.required, Validators.minLength(3)]]
    });
  }

  private visitNote(payload: NotePayload): FormGroup {
    const note = payload?.note;
    return this.fb.group({
      title: [note?.title || '', [Validators.required]]
    });
  }

  private visitProject(payload: ProjectPayload): FormGroup {
    const proj = payload?.project;
    return this.fb.group({
      title: [proj?.title || '', [Validators.required, Validators.minLength(2)]]
    });
  }

  private visitTodo(payload: TodoPayload): FormGroup {
    const todo = payload?.todo;
    return this.fb.group({
      task: [todo?.task || '', [Validators.required]]
    });
  }

  // --- HELPER METHODEN ---

  private visitNonEditable(reason: string): FormGroup {
    return this.fb.group({
      info: [{ value: reason, disabled: true }]
    });
  }

  private visitGeneric(payload: SnapshotPayload): FormGroup {
    return this.fb.group({
      rawJson: [JSON.stringify(payload, null, 2), [Validators.required]]
    });
  }
}