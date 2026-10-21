import { ISensitiveMatchInit } from '../../models/sensitive-match';

export interface ISanitizationFeedbackItemDTO {
  sensitiveMatchDto: ISensitiveMatchInit;
  feedback: boolean;
}

export interface ISanitizationFeedbackDTO {
  todoId: string;
  feedbacks: ISanitizationFeedbackItemDTO[];
}