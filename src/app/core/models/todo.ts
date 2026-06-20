import { TodoTeamStatus } from "../repositories/dto/milestone-json";
import { ITodoJSON, TodoSyncState } from "../repositories/dto/todo-json";

export enum DateStatus {
    DUE = "due",
    COMPLETED = "completed"
}

export enum VisualStatus {
    ON_TIME = "on-time",
    COMPLETED = "completed",
    OVERDUE = "overdue",
    PENDING = "pending",
    DUE_TODAY = "due-today"
}

export class Todo {
  id: string;
  task: string;
  description: string | null;
  done: boolean;
  dueDate: number;
  completedAt: number | null;
  effort: number;
  usedEffort: number;
  createdAt: number;
  userId: string;
  syncState: 'fine' | 'dirty' | 'new'; // Direkt als Typ statt extra Interface!
  category: string | null;
  effortChangesCount: number | null;
  milestoneId: string | null;
  assignedUserId?: string | null;
  isStarted?: boolean;

  // 💡 DEIN NEUER ANSATZ: Nur das absolut Wichtigste (task) ist Pflicht. Alles andere optional (?)!
  constructor(init: {
    task: string;
    id?: string;
    description?: string | null;
    done?: boolean;
    dueDate?: number;
    completedAt?: number | null;
    effort?: number;
    usedEffort?: number;
    userId?: string;
    syncState?: 'fine' | 'dirty' | 'new';
    createdAt?: number;
    category?: string | null;
    effortChangesCount?: number | null;
    milestoneId?: string | null;
    assignedUserId?: string | null;
    isStarted?: boolean;
  }) {
    // 🛡️ Wenn ein Wert im 'init' fehlt, greift automatisch das '??' mit dem Standardwert!
    this.task = init.task;
    this.id = init.id ?? 'local-' + String(Date.now() + Math.floor(Math.random() * 1000));
    this.description = init.description ?? null;
    this.done = init.done ?? false;
    this.dueDate = init.dueDate ?? Date.now();
    this.completedAt = init.completedAt ?? null;
    this.effort = init.effort ?? 1; // Standardmäßig 1 Aufwandspunkt
    this.usedEffort = init.usedEffort ?? 0;
    this.createdAt = Date.now();
    this.userId = init.userId ?? 'local-user'; // Phantastisch für Tests!
    this.syncState = init.syncState ?? 'new';
    this.category = init.category ?? null;
    this.effortChangesCount = init.effortChangesCount ?? 0;
    this.milestoneId = init.milestoneId ?? null;
    this.assignedUserId = init.assignedUserId ?? null;
    this.isStarted = init.isStarted ?? false;
  }
  public toJson(): ITodoJSON {
     return {
      id: this.id?? null,
      task: this.task,
      description: this.description,
      done: this.done,
      dueDate: this.dueDate, 
      completedAt: this.completedAt,
      effort: this.effort,
      usedEffort: this.usedEffort,
      userId: this.userId,
      createdAt: this.createdAt,
      syncState: this.syncState,
      category: this.category,
      effortChangesCount: this.effortChangesCount,
      milestoneId: this.milestoneId,
      isStarted: this.isStarted?? false,
      assignedUserId: this.assignedUserId?? null
     }
  }

  static fromTodo(oldTodo: Todo): Todo {
    const copy = new Todo( {            
             task: oldTodo.task,
             description: oldTodo.description,
             effort: oldTodo.effort,
             dueDate: oldTodo.dueDate,
             userId: oldTodo.userId,             
             usedEffort: oldTodo.usedEffort,
             createdAt: oldTodo.createdAt,
             id: oldTodo.id,
             syncState: oldTodo.syncState,
             done: oldTodo.done,
             completedAt: oldTodo.completedAt,
             category: oldTodo.category,
             effortChangesCount: oldTodo.effortChangesCount,
             milestoneId: oldTodo.milestoneId,
             isStarted: oldTodo.isStarted?? false,
             assignedUserId: oldTodo.assignedUserId?? null
  });
    return copy
  }  

  toggleComplete() {
    this.done = !this.done
    if (this.done) {
        this.completedAt = Date.now() 
    } else {
        this.completedAt = null
    }
  }

  setDescription(text: string) {
     this.description = text
  }

  getTimeStamp(): number {
    if (this.done && this.completedAt !== null) {
        return this.completedAt
    } else {
        return this.dueDate
    }
  }

  getDateStatus(): DateStatus {
    return this.done ?  DateStatus.COMPLETED : DateStatus.DUE;
  }

    public getVisualStatus(): VisualStatus {
      const now = Date.now();
  
      // Wir holen uns "Heute" um 00:00:00 Uhr zum Vergleichen
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      // Wir holen uns den Fälligkeitstag um 00:00:00 Uhr
      const dueDate = new Date(this.dueDate);
      dueDate.setHours(0, 0, 0, 0);
  
      // Fall 1: Aufgabe ist erledigt
      if (this.done) {
        return (this.completedAt !== null && this.completedAt <= this.dueDate)
          ? VisualStatus.ON_TIME
          : VisualStatus.COMPLETED;
      }
  
      // Fall 2: Aufgabe ist offen
      if (now > this.dueDate) {
        return VisualStatus.OVERDUE;
      } else if (dueDate.getTime() === today.getTime()) {
        return VisualStatus.DUE_TODAY; // 🍊 Wenn das Datum genau heute ist!
      } else {
        return VisualStatus.PENDING;
      }
    }
/**
   * 👥 Gibt an, ob die Aufgabe bereits einem Teammitglied zugewiesen wurde
   */
  public get isAssigned(): boolean {
    return this.assignedUserId !== null && this.assignedUserId !== undefined && this.assignedUserId .trim() !== '';
  }

  /**
   * 🎛️ Der virtuelle Team-Status im exakten Meilenstein-Format!
   * Extrem mächtig für spätere Statistiken im Board.
   */
  public get teamStatus(): TodoTeamStatus {
    if (this.done) {
      return 'Erledigt';
    }
    
    if (this.isStarted) {
      return 'In Arbeit';
    }
    
    return 'Offen';
  }
}
