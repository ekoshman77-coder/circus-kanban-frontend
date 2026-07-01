import { Project } from "./project";
import { UnifiedSuggestion } from "./unified-suggestion";

export interface DraftProjectWrapper {
    project: Project | null;
    degradedMilestones: string[]
}