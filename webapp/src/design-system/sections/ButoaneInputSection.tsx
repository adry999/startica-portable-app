import { useState } from 'react';
import {
  Button,
  DayStepper,
  FilterPills,
  groupTone,
  MonthPicker,
  MonthStepper,
  SearchInput,
  SearchSelect,
  SegmentedControl,
  type FilterPillGroup,
} from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import { DEMO_DAY, DEMO_GROUPS, DEMO_MAX_DAY, DEMO_MONTH, DEMO_SEARCH_SELECT_OPTIONS } from '../fixtures';
import styles from './ButoaneInputSection.module.css';

type PaymentFilterValue = 'toate' | 'achitat' | 'neachitat';

/** Butoane, câmpuri de căutare/selecție și navigatoarele de lună/zi — toate `@shared/ui`. */
export function ButoaneInputSection() {
  const [searchValue, setSearchValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [segmentValue, setSegmentValue] = useState<'tabel' | 'luni'>('tabel');
  const [groupValue, setGroupValue] = useState('toate');
  const [paymentValue, setPaymentValue] = useState<PaymentFilterValue>('toate');
  const [month, setMonth] = useState(DEMO_MONTH);
  const [stepperMonth, setStepperMonth] = useState(DEMO_MONTH);
  const [day, setDay] = useState(DEMO_DAY);

  const filterGroups: FilterPillGroup<string>[] = [
    {
      label: 'Grupă',
      value: groupValue,
      onChange: setGroupValue,
      options: [
        { value: 'toate', label: 'Toate', tone: 'neutral' },
        ...DEMO_GROUPS.map(group => ({ value: group.id, label: group.name, tone: groupTone(group.id, DEMO_GROUPS) })),
      ],
    },
    {
      label: 'Plată',
      value: paymentValue,
      onChange: value => setPaymentValue(value as PaymentFilterValue),
      options: [
        { value: 'toate', label: 'Toate', tone: 'neutral' },
        { value: 'achitat', label: 'Achitat', tone: 'mint' },
        { value: 'neachitat', label: 'Neachitat', tone: 'pink' },
      ],
    },
  ];

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Butoane &amp; input</h2>

      <ComponentShowcase
        name="Button"
        importLine="import { Button } from '@shared/ui';"
        reference="00-comun.md §A (butoane de antet) · vizual în Copii.dc.html#2a („+ Adaugă copil”)"
      >
        <DemoRow label="variant">
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="white">White</Button>
          <Button variant="outline">Outline</Button>
        </DemoRow>
        <DemoRow label="size">
          <Button size="md">Mărime md</Button>
          <Button size="lg">Mărime lg</Button>
          <Button size="header">+ Adaugă copil</Button>
        </DemoRow>
        <DemoRow label="disabled">
          <Button disabled>Primary dezactivat</Button>
          <Button variant="outline" disabled>
            Outline dezactivat
          </Button>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SearchInput"
        importLine="import { SearchInput } from '@shared/ui';"
        reference="00-comun.md §E (.search) · vizual în Copii.dc.html#2a"
      >
        <DemoRow label="control">
          <SearchInput
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Caută un copil…"
            ariaLabel="Căutare copii"
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SearchSelect"
        importLine="import { SearchSelect } from '@shared/ui';"
        reference="Grupe.dc.html#3a („Alege un copil”)"
      >
        <DemoRow label="control">
          <SearchSelect
            options={DEMO_SEARCH_SELECT_OPTIONS}
            value={selectValue}
            onChange={setSelectValue}
            ariaLabel="Alege un copil"
            placeholder="Alege un copil…"
          />
        </DemoRow>
        <DemoRow label="disabled">
          <SearchSelect
            options={DEMO_SEARCH_SELECT_OPTIONS}
            value=""
            onChange={() => {}}
            ariaLabel="Câmp dezactivat"
            disabled
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SegmentedControl"
        importLine="import { SegmentedControl } from '@shared/ui';"
        reference="00-comun.md §D · vizual în Achitari.dc.html#5a/#5b (Tabel | Pe luni)"
      >
        <DemoRow label="control">
          <SegmentedControl
            options={[
              { value: 'tabel', label: 'Tabel' },
              { value: 'luni', label: 'Pe luni' },
            ]}
            value={segmentValue}
            onChange={setSegmentValue}
            ariaLabel="Comutator vizualizare"
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="FilterPills"
        importLine="import { FilterPills, groupTone } from '@shared/ui';"
        reference="00-comun.md §B, §C · vizual în Copii.dc.html#2a"
      >
        <DemoRow label="control">
          <FilterPills groups={filterGroups} trailing={`${DEMO_GROUPS.length} grupe`} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="groupTone"
        importLine="import { groupTone } from '@shared/ui';"
        reference="00-comun.md §C — culoarea vine din poziția grupei în lista sortată alfabetic"
      >
        <DemoRow label="rezultat">
          <div className={styles.toneList}>
            {DEMO_GROUPS.map(group => (
              <span key={group.id} className={styles.tonePill} data-tone={groupTone(group.id, DEMO_GROUPS)}>
                {group.name} · {groupTone(group.id, DEMO_GROUPS)}
              </span>
            ))}
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="MonthPicker"
        importLine="import { MonthPicker } from '@shared/ui';"
        reference="08-dashboard.md (antet) · vizual în Dashboard.dc.html#1a"
      >
        <DemoRow label="control">
          <MonthPicker value={month} onChange={setMonth} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="MonthStepper"
        importLine="import { MonthStepper } from '@shared/ui';"
        reference="01-copii-zile-de-nastere.md §MonthStepper · vizual în Copii.dc.html#2c"
      >
        <DemoRow label="control">
          <MonthStepper
            value={stepperMonth}
            onPrev={() => setStepperMonth(shiftMonth(stepperMonth, -1))}
            onNext={() => setStepperMonth(shiftMonth(stepperMonth, 1))}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="DayStepper"
        importLine="import { DayStepper } from '@shared/ui';"
        reference="19-prezenta.md (antet Ziua) · vizual în Prezenta.dc.html#18a"
      >
        <DemoRow label="control">
          <DayStepper value={day} onChange={setDay} max={DEMO_MAX_DAY} />
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}

function shiftMonth(value: string, offset: number): string {
  const [year, month] = value.split('-').map(Number);
  const zeroBased = month - 1 + offset;
  const nextYear = year + Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
}
