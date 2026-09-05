// Pure helpers extracted from AgentsToZ. No feedback persistence is included.
import type { ProjectMemoryFeedbackSummary } from "./projectMemoryRecall.js";

export function projectMemoryFeedbackScopeKey(entryKey: string, contentVersionHash: string): string {
  if (!/^[0-9a-f]{24}$/.test(entryKey) || !/^[0-9a-f]{32}$/.test(contentVersionHash)) {
    throw new Error("유효한 기억 항목·본문 버전 키가 필요합니다.");
  }
  return `${entryKey}:${contentVersionHash}`;
}

export function projectMemoryPromotionState(summary: ProjectMemoryFeedbackSummary):
  | "candidate" | "active" | "contested" | "superseded" {
  if (summary.contradicted > 0 && summary.corrected > 0) return "superseded";
  if (summary.contradicted > 0 || summary.corrected > summary.confirmed) return "contested";
  if (summary.confirmed >= 2 && summary.applied >= 2) return "active";
  return "candidate";
}
