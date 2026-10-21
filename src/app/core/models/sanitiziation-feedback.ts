import { ISanitizationFeedbackDTO, ISanitizationFeedbackItemDTO } from '../repositories/dto/senisitive-feedback-dto';
import { generateLocalId } from '../shared/constants/id-const';
import { DomainModel } from './domain-model';
import { SensitiveMatch } from './sensitive-match';

/**
 * 1. Einzelnes Feedback-Item Domain Model
 */
export class SanitizationFeedbackItem implements DomainModel<SanitizationFeedbackItem> {
  id: string;
  match: SensitiveMatch;
  feedback: boolean;

  constructor(data: { id?: string; match: SensitiveMatch; feedback: boolean }) {
    this.id = data.id || generateLocalId();
    this.match = data.match;
    this.feedback = data.feedback;
  }

  public static fromJson(json: any): SanitizationFeedbackItem {
    return new SanitizationFeedbackItem({
      id: json.id,
      match: SensitiveMatch.fromJson(json.sensitiveMatchDto),
      feedback: json.feedback
    });
  }

  public toJson(): ISanitizationFeedbackItemDTO {
    return {
      sensitiveMatchDto: this.match.toJson(),
      feedback: this.feedback
    };
  }

  public cloneWith(changes: Partial<SanitizationFeedbackItem>): SanitizationFeedbackItem {
    return new SanitizationFeedbackItem({
      id: changes.id ?? this.id,
      match: changes.match ?? this.match,
      feedback: changes.feedback ?? this.feedback
    });
  }
}

/**
 * 2. Gesamt-Feedback Domain Model
 */
export class SanitizationFeedback implements DomainModel<SanitizationFeedback> {
  id: string; // Entspricht auch der todoId
  todoId: string;
  feedbacks: SanitizationFeedbackItem[];

  constructor(data: { id?: string; todoId: string; feedbacks: SanitizationFeedbackItem[] }) {
    this.id = data.id || data.todoId || generateLocalId();
    this.todoId = data.todoId;
    this.feedbacks = data.feedbacks || [];
  }

  public static fromJson(json: ISanitizationFeedbackDTO): SanitizationFeedback {
    return new SanitizationFeedback({
      id: json.todoId,
      todoId: json.todoId,
      feedbacks: (json.feedbacks || []).map(item => SanitizationFeedbackItem.fromJson(item))
    });
  }

  public toJson(): ISanitizationFeedbackDTO {
    return {
      todoId: this.todoId,
      feedbacks: this.feedbacks.map(f => f.toJson())
    };
  }

  public cloneWith(changes: Partial<SanitizationFeedback>): SanitizationFeedback {
    return new SanitizationFeedback({
      id: changes.id ?? this.id,
      todoId: changes.todoId ?? this.todoId,
      feedbacks: changes.feedbacks ?? this.feedbacks
    });
  }

  /**
   * 🛠️ Hilfsmethode für das Feedback aus der Component-Map
   */
  public static fromFeedbackMap(
    todoId: string,
    matches: SensitiveMatch[],
    feedbackMap: Map<string, boolean | null>
  ): SanitizationFeedback {
    const feedbackItems: SanitizationFeedbackItem[] = [];

    for (const match of matches) {
      const userChoice = feedbackMap.get(match.id);
      // Nur Entscheidungen übernehmen, die explizit getroffen wurden (true oder false)
      if (userChoice !== null && userChoice !== undefined) {
        feedbackItems.push(new SanitizationFeedbackItem({ match, feedback: userChoice }));
      }
    }

    return new SanitizationFeedback({ todoId, feedbacks: feedbackItems });
  }
}