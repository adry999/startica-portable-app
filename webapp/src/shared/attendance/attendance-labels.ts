import type { AttendanceStatus } from '#features/attendance/attendance.types.d.mts';

export const STATUS_LABEL: Record<AttendanceStatus | 'unmarked', string> = {
  present: 'Prezent',
  absent: 'Absent',
  excused: 'Motivat',
  unmarked: 'Nemarcat',
};

export const STATUS_MARK: Record<AttendanceStatus | 'unmarked', string> = {
  present: '✓',
  absent: '×',
  excused: 'M',
  unmarked: '',
};
