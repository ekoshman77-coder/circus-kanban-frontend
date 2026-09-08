    export interface BatchCreatePermissionsDto {
     resource: string,
     scope: string,
     roles: string[],      // Multi-Select
     actions: string[],  // Multi-Select
     specialization?: string
    }

    
