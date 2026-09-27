export {
  ATTENDANCE_STATUSES,
  EXCUSE_SUGGESTIONS,
  REASON_MAX_LENGTH,
  MAX_CHANGES_PER_REQUEST,
  attendanceKey,
  nextAttendanceStatus,
  isChildEnrolledOn,
  summarizeDay,
  changesToMarkUnmarkedPresent,
  normalizeAttendanceChange,
} from './domain/attendance-rules.mjs';
export { monthDates, summarizeMonth } from './domain/attendance-month.mjs';
