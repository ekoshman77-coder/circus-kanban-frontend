import { Component, computed, effect, inject, OnInit, output, Output, signal } from '@angular/core';
import { DepartmentService } from '../../../services/admin/department-service';
import { MasterDataService } from '../../../services/admin/master-data-service';
import { InvitationService } from '../../../services/invitation/invitation-service';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

export class DepartmentView {
  id: string
  departmentName: string
  isChecked: boolean
  constructor(id: string, departmentName: string, isChecked?: boolean) {
    this.id = id
    this.departmentName = departmentName;
    this.isChecked = isChecked ?? false
  }

  public toggleCheck() {
    this.isChecked = !this.isChecked
  }

  public check() {
    this.isChecked = true
  }

  public uncheck() {
    this.isChecked = false
  }
}

export class RolesView {
  name: string
  isChecked: boolean

  constructor(name: string, isChecked: boolean = true) {
    this.name = name,
      this.isChecked = isChecked
  }

  public toggleCheck() {
    this.isChecked = !this.isChecked
  }

  public check() {
    this.isChecked = true
  }

  public uncheck() {
    this.isChecked = false
  }
}

const ROLES_CONTROL_NAME = 'roles';

export interface DepartmentsSelectResult {
  departmentIds: string[]
  roles: string[]
}

@Component({
  selector: 'app-departmet-select-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './departmet-select-modal.html',
  styleUrl: './departmet-select-modal.css',
})
export class DepartmetSelectModal implements OnInit {

  private invitationService = inject(InvitationService);
  private masterDataService = inject(MasterDataService)

  public selected = output<DepartmentsSelectResult>()

  public departmentViews = signal<DepartmentView[]>([])
  public departmentRoles = this.masterDataService.departmentRoles

  private rolesArray = new FormArray<FormControl<RolesView>>([])

  public rolesForm: FormGroup = new FormGroup( {
    roles: this.rolesArray
  })

  public formControls = computed(() => {
    return this.rolesArray.controls as FormControl<RolesView>[]
  })

  ngOnInit(): void {
//    this.invitationService.loadDepartmentsForInvitation()
    this.createRolesList()
  }

  constructor() {
      this.rolesArray.valueChanges.subscribe({
      next: (next) => {
        const someChecked = next.some(role => role.isChecked)
        if (!someChecked) {
          this.rolesArray.controls.forEach(element => {
            element.value.check()
          });
        }
      }
    })

    effect(() => {
      if (!this.invitationService.departments()) {
        return
      }
      this.createDepartmantList()
    })
  }

  private createRolesList() {
    const roleControls = this.departmentRoles().map((role) => new FormControl<RolesView>(new RolesView(role), { nonNullable: true }))
    this.rolesArray.clear()
    roleControls.forEach((control) => this.rolesArray.push(control))
 
  }

  private createDepartmantList() {
    console.log("createDepartmentList", this.invitationService.departments())
    this.departmentViews.set(
      this.invitationService.departments().map((dept) => new DepartmentView(dept.id, dept.name))
    )
  }

  public toggleRoleCheck(control: FormControl<RolesView>) {
   console.log('1. Methode aufgerufen für:', control.value.name);
   console.log('2. Vor Toggle:', control.value.isChecked);

   const value = control.value;
   value.toggleCheck();
   control.setValue(new RolesView(value.name, value.isChecked));

   console.log('3. Nach Toggle:', control.value.isChecked);  
  }

  public isRoleChecked(control: FormControl<RolesView>): boolean {
    return control.value.isChecked;
  }

  public onSelectAll() {
    const depts = this.departmentViews()
    depts.forEach((dep) => dep.check())
    this.departmentViews.set(depts)
  }

  public onUnselectAll() {
    const depts = this.departmentViews()
    depts.forEach((dep) => dep.uncheck())
    this.departmentViews.set(depts)
  }

  public cancelSelect() {
    this.selected.emit({ departmentIds: [], roles: []})
  }

  public onSelectFinish() {
    const selectedDepts = this.departmentViews()
      .filter((view) => view.isChecked)
      .map((view) => view.id)

    if (!this.rolesForm) {
      this.selected.emit({
        departmentIds: selectedDepts,
        roles: []
      })
      return
    }

    const rolesResult = (this.rolesForm.get(ROLES_CONTROL_NAME)?.value as RolesView[])
      .filter((r) => r.isChecked)
      .map(r => r.name)

    this.selected.emit({ departmentIds: selectedDepts, roles: rolesResult })
    return
  }
}

