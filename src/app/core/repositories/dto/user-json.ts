export interface IUserJSON {
  id: string;
  firstName: string;
  lastName: string;
  username: string; 
  role: string;
  // 🔑 Das ist der eindeutige LOGIN-Name (z.B. "elena_h")
  projectIds: string[];
}
