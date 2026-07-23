import { Todo } from './todo'; // Pfad zu deinem Todo-Modell anpassen

export interface TodoBulkDto extends Partial<Todo> {
  id: string;
  // 🏷️ Das exakte Gegenstück zum Server-Zettelchen!
  syncAction: 'CREATED' | 'UPDATED' | 'DELETED' | 'DIRTY_AND_DELETED' | 'CREATED_AND_DELETED';
}