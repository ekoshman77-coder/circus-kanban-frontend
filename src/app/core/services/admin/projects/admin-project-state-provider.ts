import { ProjectStateProvider } from "../../project/project-state-provider";

export class AdminProjectStateProvider extends ProjectStateProvider {
  // 🛡️ Eigener Storage-Key für den Admin-Cache!
  protected override storageKey = 'local_admin_projects_global_pool';
}