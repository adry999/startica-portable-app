import { Board, type BoardColumn } from '@shared/ui/Board';
import { DayGrid, type DayGridRow } from '@shared/ui/DayGrid';
import { MonthCalendar, type MonthCalendarDay } from '@shared/ui/MonthCalendar';
import { WeekGrid, type WeekGridEvent } from '@shared/ui/WeekGrid';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import styles from './GriduriSection.module.css';

const DAY_GRID_COLUMNS = ['1', '2', '3', '4', '5', '6', '7'];

const PREZENTA_ROWS: DayGridRow[] = [
  {
    key: 'r1',
    label: 'Ionescu Maria',
    cells: [
      { key: 'c1', tone: 'mint', ariaLabel: '1 septembrie, prezent', onClick: () => {} },
      { key: 'c2', tone: 'mint', ariaLabel: '2 septembrie, prezent', onClick: () => {} },
      { key: 'c3', isWeekend: true, ariaLabel: '3 septembrie, weekend' },
      { key: 'c4', isWeekend: true, ariaLabel: '4 septembrie, weekend' },
      { key: 'c5', tone: 'raspberry', ariaLabel: '5 septembrie, absent', onClick: () => {} },
      { key: 'c6', isToday: true, tone: 'mint', ariaLabel: '6 septembrie, prezent', saving: true },
      { key: 'c7', tone: 'neutral', ariaLabel: '7 septembrie, neconsemnat', onClick: () => {} },
    ],
  },
  {
    key: 'r2',
    label: 'Popescu Andrei',
    loading: true,
    cells: DAY_GRID_COLUMNS.map((_, index) => ({
      key: `l${index}`,
      isWeekend: index === 2 || index === 3,
      ariaLabel: 'Se încarcă',
    })),
  },
];

const PONTAJ_ROWS: DayGridRow[] = [
  {
    key: 'p1',
    label: 'Rusu Ana',
    cells: [
      { key: 'p1c1', content: '8h', ariaLabel: '1 septembrie, 8 ore', onClick: () => {} },
      { key: 'p1c2', content: 'CO', tone: 'yellow', ariaLabel: '2 septembrie, concediu odihnă', onClick: () => {} },
      { key: 'p1c3', isWeekend: true, ariaLabel: '3 septembrie, weekend' },
      { key: 'p1c4', isWeekend: true, ariaLabel: '4 septembrie, weekend' },
      { key: 'p1c5', content: '8h', isToday: true, ariaLabel: '5 septembrie, 8 ore', onClick: () => {} },
      { key: 'p1c6', content: 'CM', tone: 'raspberry', ariaLabel: '6 septembrie, concediu medical', onClick: () => {} },
      { key: 'p1c7', content: '4h', ariaLabel: '7 septembrie, 4 ore', onClick: () => {} },
    ],
  },
];

const CONCEDII_ROWS: DayGridRow[] = [
  {
    key: 'co1',
    label: 'Marin Elena',
    cells: [
      { key: 'co1c1', tone: 'transparent', ariaLabel: '1 septembrie, fără concediu' },
      { key: 'co1c2', tone: 'yellow', ariaLabel: '2 septembrie, concediu planificat', onClick: () => {} },
      { key: 'co1c3', tone: 'yellow', ariaLabel: '3 septembrie, concediu planificat', onClick: () => {} },
      { key: 'co1c4', tone: 'yellow', ariaLabel: '4 septembrie, concediu planificat', onClick: () => {} },
      { key: 'co1c5', tone: 'transparent', ariaLabel: '5 septembrie, fără concediu' },
      { key: 'co1c6', isToday: true, tone: 'transparent', ariaLabel: '6 septembrie, fără concediu' },
      { key: 'co1c7', tone: 'transparent', ariaLabel: '7 septembrie, fără concediu' },
    ],
  },
];

const WEEK_GRID_DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
const WEEK_GRID_HOUR_LABELS = ['09:00', '10:00', '11:00', '12:00', '13:00'];

const WEEK_GRID_EVENTS: WeekGridEvent[] = [
  { key: 'w1', dayIndex: 0, startRow: 0, rowSpan: 2, label: 'Grupa Delfin', onClick: () => {} },
  { key: 'w2', dayIndex: 2, startRow: 1, rowSpan: 1, label: 'Grupa Balena', onClick: () => {} },
  { key: 'w3', dayIndex: 5, startRow: 3, rowSpan: 2, label: 'Grup privat', onClick: () => {} },
];

const MONTH_CALENDAR_WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function buildMonthCalendarDays(): MonthCalendarDay[] {
  const days: MonthCalendarDay[] = [];
  for (let i = -3; i < 39; i++) {
    const dayNumber = ((i % 30) + 30) % 30 || 30;
    const isCurrentMonth = i >= 0 && i < 30;
    const events =
      dayNumber === 12
        ? [
            { key: 'e1', label: 'Aniversare Coceva Alisa', tone: 'orange' as const },
            { key: 'e2', label: 'Vizită medic — Grupa Mars', tone: 'mint' as const },
            { key: 'e3', label: 'Excursie Grupa Delfin', tone: 'yellow' as const },
            { key: 'e4', label: 'Concediu Rusu Ana', tone: 'teal' as const },
          ]
        : dayNumber === 20
          ? [{ key: 'e5', label: 'Ședință părinți', tone: 'pink' as const }]
          : [];
    days.push({
      date: `2026-09-${String(dayNumber).padStart(2, '0')}`,
      dayNumber,
      isCurrentMonth,
      isToday: isCurrentMonth && dayNumber === 6,
      events,
    });
  }
  return days.slice(0, 42);
}

const BOARD_COLUMNS: BoardColumn[] = [
  {
    key: 'sosit',
    title: 'Sosit',
    cards: [
      { key: 'b1', label: 'Ionescu Maria' },
      { key: 'b2', label: 'Popescu Andrei' },
    ],
  },
  { key: 'in-curte', title: 'În curte', cards: [{ key: 'b3', label: 'Rusu Ana' }] },
  { key: 'plecat', title: 'Plecat', cards: [] },
  { key: 'mars', title: 'Grupa Mars', cards: [], disabledReason: 'Grupa e plină' },
];

/** Componente pentru grile de zile/săptămâni/lună și panoul cu coloane trase (COMPONENTE.md §0e/§0f). */
export function GriduriSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Grile</h2>

      <ComponentShowcase
        name="DayGrid"
        importLine="import { DayGrid } from '@shared/ui';"
        reference="18b Prezența Luna · 23e Pontaj · 23f Concedii — vizual în Prezenta.dc.html#18b, Personal.dc.html#23e/23f"
      >
        <DemoRow label='Prezența Luna — kind="dot"'>
          <DayGrid
            kind="dot"
            columnLabels={DAY_GRID_COLUMNS}
            rows={PREZENTA_ROWS}
            footer={['1', '2', '—', '—', '1', '2', '2']}
          />
        </DemoRow>
        <DemoRow label='Pontaj — kind="code"'>
          <DayGrid kind="code" columnLabels={DAY_GRID_COLUMNS} rows={PONTAJ_ROWS} />
        </DemoRow>
        <DemoRow label='Concedii — kind="bar" (v1 simplificat)'>
          <DayGrid kind="bar" columnLabels={DAY_GRID_COLUMNS} rows={CONCEDII_ROWS} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="WeekGrid"
        importLine="import { WeekGrid } from '@shared/ui';"
        reference="Bazin — programări săptămânale, vizual în Bazin.dc.html#30g"
      >
        <DemoRow label="control">
          <WeekGrid
            dayLabels={WEEK_GRID_DAY_LABELS}
            hourLabels={WEEK_GRID_HOUR_LABELS}
            events={WEEK_GRID_EVENTS}
            onEmptyCellClick={() => {}}
          />
        </DemoRow>
        <DemoRow label="loading">
          <WeekGrid dayLabels={WEEK_GRID_DAY_LABELS} hourLabels={WEEK_GRID_HOUR_LABELS} events={[]} loading />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="MonthCalendar"
        importLine="import { MonthCalendar } from '@shared/ui';"
        reference="30h — calendar lunar cu pastile de evenimente, zile din altă lună la .45"
      >
        <DemoRow label="control">
          <MonthCalendar
            weekdayLabels={MONTH_CALENDAR_WEEKDAYS}
            days={buildMonthCalendarDays()}
            onDayClick={() => {}}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Board"
        importLine="import { Board } from '@shared/ui';"
        reference="31a — panou cu coloane trase (v1 simplificat, fără reordonare cu tastatura)"
      >
        <DemoRow label="control">
          <Board columns={BOARD_COLUMNS} onMoveCard={() => {}} />
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}
