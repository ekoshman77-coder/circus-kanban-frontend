import { Identifiable } from "./identifable";
import { ITodoJSON } from "../repositories/dto/todo-json";
import { generateLocalId } from "../shared/constants/id-const";

export enum DateStatus {
  DUE = "due",
  COMPLETED = "completed"
}

export type TeamStatus = 'BACKLOG' | 'OPEN' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export enum VisualStatus {
  ON_TIME = "on-time",
  COMPLETED = "completed",
  OVERDUE = "overdue",
  PENDING = "pending",
  DUE_TODAY = "due-today"
}

export class Todo implements Identifiable {
  id: string;
  task: string;
  description: string | null;
  done: boolean;
  dueDate: number;
  completedAt: number | null;
  effort: number;
  reviewerId?: string | null;
  reviewerUsedEffort: number;
  usedEffort: number;
  createdAt: number;
  teamStatus: TeamStatus;
  userId: string;
  syncState: 'fine' | 'dirty' | 'new';
  category: string | null;
  effortChangesCount: number | null;
  milestoneId: string | null;
  assignedUserId?: string | null;
  isStarted?: boolean;
  lastDeveloperId?: string | null;

  constructor(init: {
    task: string;
    id?: string;
    description?: string | null;
    done?: boolean;
    dueDate?: number;
    completedAt?: number | null;
    effort?: number;
    reviewerId?: string | null;
    reviewerUsedEffort?: number;
    usedEffort?: number;
    userId?: string;
    teamStatus?: TeamStatus | string;
    syncState?: 'fine' | 'dirty' | 'new';
    createdAt?: number;
    category?: string | null;
    effortChangesCount?: number | null;
    milestoneId?: string | null;
    assignedUserId?: string | null;
    isStarted?: boolean;
    lastDeveloperId?: string | null;
  }) {
    this.task = init.task;
    this.id = init.id ?? generateLocalId();
    this.description = init.description ?? null;
    this.done = init.done ?? false;
    this.dueDate = init.dueDate ?? Date.now();
    this.completedAt = init.completedAt ?? null;
    this.effort = init.effort ?? 1;
    this.reviewerId = init.reviewerId ?? null;
    this.reviewerUsedEffort = init.reviewerUsedEffort ?? 0;
    this.usedEffort = init.usedEffort ?? 0;
    this.createdAt = init.createdAt ?? Date.now();
    this.userId = init.userId ?? 'local-user';
    this.syncState = init.syncState ?? 'new';
    this.category = init.category ?? null;
    this.effortChangesCount = init.effortChangesCount ?? 0;
    this.milestoneId = init.milestoneId ?? null;
    this.assignedUserId = init.assignedUserId ?? null;
    this.isStarted = init.isStarted ?? false;
    this.teamStatus = (init.teamStatus as TeamStatus) ?? 'BACKLOG';
    this.lastDeveloperId = init.lastDeveloperId ?? null;
  }

  public toJson(): ITodoJSON {
    return {
      id: this.id ?? null,
      task: this.task,
      description: this.description,
      done: this.done,
      dueDate: this.dueDate,
      completedAt: this.completedAt,
      effort: this.effort,
      reviewerId: this.reviewerId ?? null,
      reviewerUsedEffort: this.reviewerUsedEffort ?? 0,
      usedEffort: this.usedEffort,
      userId: this.userId,
      createdAt: this.createdAt,
      syncState: this.syncState,
      category: this.category,
      effortChangesCount: this.effortChangesCount,
      milestoneId: this.milestoneId,
      isStarted: this.isStarted ?? false,
      assignedUserId: this.assignedUserId ?? null,
      teamStatus: this.teamStatus,
      lastDeveloperId: this.lastDeveloperId ?? null
    };
  }

  static fromJson(json: ITodoJSON): Todo {
    return new Todo({
      id: json.id,
      task: json.task,
      description: json.description,
      done: json.done,
      dueDate: json.dueDate,
      completedAt: json.completedAt,
      effort: json.effort,
      reviewerId: json.reviewerId ?? null,
      reviewerUsedEffort: json.reviewerUsedEffort ?? 0,
      usedEffort: json.usedEffort,
      userId: json.userId,
      createdAt: json.createdAt,
      syncState: (json.syncState as 'fine' | 'dirty' | 'new') ?? 'fine',
      category: json.category,
      effortChangesCount: json.effortChangesCount,
      milestoneId: json.milestoneId,
      isStarted: json.isStarted ?? false,
      assignedUserId: json.assignedUserId ?? null,
      teamStatus: (json.teamStatus as TeamStatus) ?? 'BACKLOG',
      lastDeveloperId: json.lastDeveloperId ?? null
    });
  }

  public cloneWith(changes: Partial<Todo>): Todo {
    return new Todo({
      ...this,
      ...changes
    });
  }

  public static fromTodo(todo: Todo): Todo {
    return todo.cloneWith({});
  }

  toggleComplete() {
    this.done = !this.done;
    this.completedAt = this.done ? Date.now() : null;
  }

  setDescription(text: string) {
    this.description = text;
  }

  getTimeStamp(): number {
    return this.done && this.completedAt !== null ? this.completedAt : this.dueDate;
  }

  getDateStatus(): DateStatus {
    return this.done ? DateStatus.COMPLETED : DateStatus.DUE;
  }

  public getVisualStatus(): VisualStatus {
    if (this.done) {
      return (this.completedAt !== null && this.completedAt <= this.dueDate)
        ? VisualStatus.ON_TIME
        : VisualStatus.COMPLETED;
    }

    const now = Date.now();
    const todayEnd = new Date().setHours(23, 59, 59, 999);

    if (this.dueDate < now) {
      return VisualStatus.OVERDUE;
    } else if (this.dueDate <= todayEnd) {
      return VisualStatus.DUE_TODAY;
    } else {
      return VisualStatus.PENDING;
    }
  }

  public get isAssigned(): boolean {
    return !!this.assignedUserId && this.assignedUserId.trim() !== '';
  }

  public get isExpress(): boolean {
    if (this.createdAt && this.completedAt) {
      return Math.abs(this.completedAt - this.createdAt) < 5 * 60 * 1000;
    }
    return false;
  }
}