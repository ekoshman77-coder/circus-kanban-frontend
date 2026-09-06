export interface UpdateRolePermissionDto{
    id: string;
    targetScope: string;
    specialization: string;
}

export interface CreateRolePermissionDto{
    role: string;
    resource: string;
    action: string;
    targetScope: string;
    specialization: string;
}

export interface RolePermissionResponseDto{
    id: string;
    role: string;
    resource: string;
    action: string;
    targetScope: string;
    specialization: string;
}