export interface IUserJson {
  id: string;
  firstName: string;
  lastName: string;
  username: string; 
  // 🔑 Das ist der eindeutige LOGIN-Name (z.B. "elena_h")
  projectIds: string[];
  departmentId?: string;
}
