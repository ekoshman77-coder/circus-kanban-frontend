import { SnapshotPayload } from "./queue-item";
import { IDepartment } from "../../repositories/dto/deparment-json";
import { Department } from "../department"; // Oder entsprechendes Modell

// 1. Basis für alle Department-Payloads mit IDepartmentJSON-Snapshot
export interface DepartmentSnapshotPayload extends SnapshotPayload< IDepartment> {}

// 2. CREATE & UPDATE: Benötigt die Department-Daten
export interface DepartmentPayload extends DepartmentSnapshotPayload {
  department: Department;
}

// 3. DELETE: Benötigt nur die ID (erbt id aus DepartmentSnapshotPayload)
export interface DeleteDepartmentPayload extends DepartmentSnapshotPayload {}