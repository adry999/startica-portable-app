import { useState } from 'react';
import {
  Button,
  Checkbox,
  DayStepper,
  Field,
  FilterPills,
  groupTone,
  MonthPicker,
  MonthStepper,
  SearchInput,
  SearchSelect,
  SegmentedControl,
  TextArea,
  TextField,
  TextInput,
  Toggle,
  TonePicker,
  type FilterPillGroup,
} from '@shared/ui';
import { SERVICE_TONES } from '@domain/record-schema.mjs';
import { shiftMonth } from '@shared/format/month-shift';
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
  const [textAreaValue, setTextAreaValue] = useState('');
  const [textFieldValue, setTextFieldValue] = useState('');
  const [textInputValue, setTextInputValue] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [checkboxOn, setCheckboxOn] = useState(true);
  const [checkboxOff, setCheckboxOff] = useState(false);
  const [toneValue, setToneValue] = useState<string>(SERVICE_TONES[0]);

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
        name="TextField"
        importLine="import { TextField } from '@shared/ui';"
        reference="Notificări — SMS nou (11c/11d) „Alt număr” (nume/telefon)"
      >
        <DemoRow label="control">
          <TextField value={textFieldValue} onChange={setTextFieldValue} placeholder="Nume" ariaLabel="Nume" />
        </DemoRow>
        <DemoRow label="invalid">
          <TextField value="123" onChange={() => {}} ariaLabel="Telefon" invalid />
        </DemoRow>
        <DemoRow label="disabled">
          <TextField value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="TextInput"
        importLine="import { TextInput } from '@shared/ui';"
        reference="COMPONENTE.md §0/25a — câmp de bază pentru toate formularele"
      >
        <DemoRow label="control">
          <TextInput value={textInputValue} onChange={setTextInputValue} placeholder="ex. Excursie" ariaLabel="Nume" />
        </DemoRow>
        <DemoRow label="cu prefix/sufix">
          <TextInput value="150" onChange={() => {}} ariaLabel="Preț" suffix="lei" />
        </DemoRow>
        <DemoRow label="invalid">
          <TextInput value="abc" onChange={() => {}} ariaLabel="Sumă" invalid />
        </DemoRow>
        <DemoRow label="disabled">
          <TextInput value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Field"
        importLine="import { Field, TextInput } from '@shared/ui';"
        reference="COMPONENTE.md §0/25a — etichetă + ajutor/eroare pentru orice control de formular"
      >
        <DemoRow label="control">
          <Field label="Nume" htmlFor="ds-field-nume" hint="Cum apare în listă">
            <TextInput
              id="ds-field-nume"
              value={fieldValue}
              onChange={setFieldValue}
              ariaDescribedBy="ds-field-nume-desc"
            />
          </Field>
        </DemoRow>
        <DemoRow label="opțional">
          <Field label="Poreclă" htmlFor="ds-field-porecla" optional>
            <TextInput id="ds-field-porecla" value="" onChange={() => {}} />
          </Field>
        </DemoRow>
        <DemoRow label="eroare">
          <Field label="Telefon" htmlFor="ds-field-telefon" error="Telefonul nu e valid">
            <TextInput
              id="ds-field-telefon"
              value="078"
              onChange={() => {}}
              invalid
              ariaDescribedBy="ds-field-telefon-desc"
            />
          </Field>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="TextArea"
        importLine="import { TextArea } from '@shared/ui';"
        reference="Notificări — SMS nou (11c/11d) „Text liber”"
      >
        <DemoRow label="control">
          <TextArea
            value={textAreaValue}
            onChange={setTextAreaValue}
            placeholder="Scrie un mesaj…"
            ariaLabel="Text liber"
          />
        </DemoRow>
        <DemoRow label="disabled">
          <TextArea value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
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
        name="Toggle"
        importLine="import { Toggle } from '@shared/ui';"
        reference="12-administrare.md §10b (comutatoare Canale) · vizual în Administrare.dc.html#10b"
      >
        <DemoRow label="control">
          <Toggle checked={toggleOn} onChange={setToggleOn} ariaLabel="Restanțe" />
          <Toggle checked={toggleOff} onChange={setToggleOff} ariaLabel="Probleme la backup" />
        </DemoRow>
        <DemoRow label="disabled">
          <Toggle checked={true} onChange={() => {}} ariaLabel="Comutator dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Checkbox"
        importLine="import { Checkbox } from '@shared/ui';"
        reference="COMPONENTE.md §25c · Achitare nouă 15b „Trimite confirmare…prin SMS”"
      >
        <DemoRow label="control">
          <Checkbox checked={checkboxOn} onChange={setCheckboxOn} ariaLabel="Trimite confirmare prin SMS" />
          <Checkbox checked={checkboxOff} onChange={setCheckboxOff} ariaLabel="Trimite confirmare prin SMS" />
        </DemoRow>
        <DemoRow label="disabled">
          <Checkbox checked={false} onChange={() => {}} ariaLabel="Bifă dezactivată" disabled />
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
        name="TonePicker"
        importLine="import { TonePicker } from '@shared/ui';"
        reference="Administrare.dc.html#10d (Serviciu nou) · Grupe.dc.html#4c — 8 pătrate de ton, selectat = border 2px `-ink`"
      >
        <DemoRow label="control">
          <TonePicker ariaLabel="Culoare" tones={SERVICE_TONES} value={toneValue} onChange={setToneValue} />
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
