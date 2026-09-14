import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionUrl } from './links';
import { Permission } from '../models/permission';
import { PermissionJson } from './dto/permission-json';
import { BatchCreatePermissionsPayload } from '../models/queue-items/permission-queue-item';

@Injectable({
  providedIn: 'root'
})
export class PermissionRepository {
  private http = inject(HttpClient);

  public getPermissions(): Observable< PermissionJson[]> {
    return this.http.get< PermissionJson[]>(PermissionUrl);
  }

  public createPermission(permission: Permission): Observable< PermissionJson> {
    const body = permission.mapToJson();
    return this.http.post< PermissionJson>(PermissionUrl, body);
  }

  public batchCreatePermissions(payload: BatchCreatePermissionsPayload): Observable< PermissionJson[]> {
    // Strippen von snapshot vor dem HTTP-Call
    const { snapshot, ...body } = payload;
    return this.http.post< PermissionJson[]>(`${PermissionUrl}/batch`, body);
  }

  public updatePermission(permission: Permission): Observable< PermissionJson> {
    const body = permission.mapToJson();
    return this.http.put< PermissionJson>(PermissionUrl, body);
  }

  public deletePermission(id: string): Observable< void> {
    return this.http.delete< void>(`${PermissionUrl}/${id}`);
  }
}