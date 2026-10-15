export interface IgnoredMilestones {
    userId: string,
    projectTitle: string,
    area: string,
    milestoneTitles: string[]
}

/** 
 * Das einheitliche Payload für die Interaktion mit einem einzelnen Meilenstein-Vorschlag
 */
export interface MilestoneInteractionPayload {
  projectTitle: string;
  milestoneTitle: string;
  area: string;
  userId: string;
}