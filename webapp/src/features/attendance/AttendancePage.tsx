export interface AttendancePageProps {
  month: string;
}

/** Placeholder — înlocuit de ecranul complet (Ziua/Luna) în task-ul 9. */
export function AttendancePage({ month }: AttendancePageProps) {
  return <h2>Prezența · {month}</h2>;
}
