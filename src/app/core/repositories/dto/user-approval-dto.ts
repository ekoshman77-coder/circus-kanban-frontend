export interface UserApproveDto {
  departmentId: string;
  departmentRole: string; // 👈 NEU: z. B. "MEMBER" oder "DEPARTMENT_HEAD"
}