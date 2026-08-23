import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CreateRolePermissionDto, RolePermissionResponseDto, UpdateRolePermissionDto } from "./dto/role-permissions";
import { PermissionUrl } from "./links";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class PermissionRepository {
    private http = inject(HttpClient)

    public getPermissions(): Observable<RolePermissionResponseDto[]> {
        console.log("PERMISSION_REPOSOTORY: GET")
        return this.http.get<RolePermissionResponseDto[]>(PermissionUrl)
    }

    public createPermission(permission: CreateRolePermissionDto): Observable<RolePermissionResponseDto> {
        console.log("PERMISSION_REPOSOTORY: POST", permission)
        return this.http.post<RolePermissionResponseDto>(PermissionUrl, permission)
    }

    public updatePermission(permission: UpdateRolePermissionDto): Observable<RolePermissionResponseDto> {
        console.log("PERMISSION_REPOSOTORY: PUT", permission)
        return this.http.put<RolePermissionResponseDto>(PermissionUrl, permission)
    }

    public deletePermission(id: string): Observable<void> {
        console.log("PERMISSION_REPOSOTORY: DELETE id=",id)
        return this.http.delete<void>(`${PermissionUrl}/${id}`)
    }
}