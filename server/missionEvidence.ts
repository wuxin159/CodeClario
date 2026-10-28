import type { LearningDatabase } from "./database.ts";
import type { Mission } from "../shared/mission.ts";
import { findLesson } from "../shared/curriculum.ts";
import { retestsFor } from "./retests.ts";

// Shared by the task gate and the model context: a historical answer cannot
// satisfy a newly started task's course check.
export function courseReviewEvidence(
  store: LearningDatabase,
  userId: string,
  mission: Mission,
) {
  const required = !retestsFor(findLesson(mission.lessonId)!).length;
  const row = required
    ? (store.db
        .prepare(
          "SELECT answer,correct FROM learning_events WHERE user_id=? AND lesson_id=? AND kind='review' AND created_at>=? ORDER BY id DESC LIMIT 1",
        )
        .get(userId, mission.lessonId, mission.createdAt) as
        | { answer: number; correct: number }
        | undefined)
    : undefined;
  return {
    required,
    passed: row?.correct === 1,
    record: row ? { answer: row.answer, correct: !!row.correct } : undefined,
  };
}
