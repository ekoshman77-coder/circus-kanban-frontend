import { Todo } from "./todo";

export interface TodoBulkDto {
  id?: string;               // Optional, da ein Massenlöschen keine einzelne ID hat
  syncAction: 'CREATED' | 'UPDATED' | 'DELETED' | 'CREATED_AND_DELETED' | 'DIRTY_AND_DELETED' | 'BULK_DELETE_COMPLETED' | 'BULK_DELETE_ALL';
  todo?: Todo;                // Das eigentliche To-Do-Objekt (falls zutreffend)
  timestamp: number;         // Für die garantierte Einhaltung der Reihenfolge!
}