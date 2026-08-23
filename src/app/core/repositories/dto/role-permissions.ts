export interface UpdateRolePermissionDto{
    id: string;
    targetScope: string;
}

export interface CreateRolePermissionDto{
    role: string;
    resource: string;
    action: string;
    targetScope: string;
}

export interface RolePermissionResponseDto{
    id: string;
    role: string;
    resource: string;
    action: string;
    targetScope: string;
}