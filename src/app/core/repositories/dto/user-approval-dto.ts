export interface UserApproveDto {
  departmentId: string;
  departmentRole: string;
  supervisorId?: string | null;
}