import { generateLocalId } from "../shared/constants/id-const";

export class Permission{
    id?: string;
    role: string;
    resource: string;
    action: string;
    targetScope: string;
    specialization?: string;
    constructor(init: {
        id?: string,
        role: string,
        resource: string,
        action: string,
        targetScope: string,
        specialization?: string;
    }) {
        this.id = init.id?? generateLocalId();
        this.role = init.role;
        this.resource = init.resource;
        this.action = init.action;
        this.targetScope = init.targetScope;
        this.specialization = init.specialization
    }

    static fromJson(json: any): Permission {
        return new Permission({
            id: json.id,
            role: json.role,
            resource: json.resource,
            action: json.action,
            targetScope: json.targetScope,
            specialization: json.specialization
        })
    }

    public mapToJson(): any {
        return {
            id: this.id,
            role: this.role,
            resource: this.resource,
            action: this.action,
            targetScope: this.targetScope,
            specialization: this.specialization
        }
    }

    public isEqualPermission(permission: Permission): boolean {
        return this.role === permission.role 
               && this.action === permission.action
               && this.resource === permission.resource
               && this.targetScope === permission.targetScope
               && this.specialization === permission.specialization 
    }

}