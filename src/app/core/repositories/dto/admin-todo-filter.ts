export interface AdminTodoFilter {
  departmentId?: string;
  projectId?: string;
  targetUserId?: string;
  isArchived: boolean;
  fromDate?: number;
  toDate?: number;
}