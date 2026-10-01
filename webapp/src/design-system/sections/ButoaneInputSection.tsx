import { useState } from 'react';
import {
  ActiveFilters,
  AmountInput,
  Button,
  Checkbox,
  ChipSelect,
  ChoiceCards,
  DateInput,
  DayStepper,
  Field,
  FileInput,
  FilterMenu,
  FilterPills,
  FormGrid,
  FormSection,
  groupTone,
  IconButton,
  InlineEdit,
  MonthInput,
  MonthPicker,
  MonthStepper,
  MultiSelect,
  NumberInput,
  PeriodFilter,
  PhoneInput,
  RadioGroup,
  SearchInput,
  SearchSelect,
  SegmentedControl,
  Select,
  SelectableRow,
  SelectableTile,
  StatusIconButton,
  TagInput,
  TextArea,
  TextField,
  TextInput,
  TimeInput,
  Toggle,
  TonePicker,
  type FilterPillGroup,
} from '@shared/ui';
import { AttendanceDot } from '@shared/attendance';
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
  const [selectRelationValue, setSelectRelationValue] = useState('');
  const [phoneInputValue, setPhoneInputValue] = useState('');
  const [fileInputValue, setFileInputValue] = useState('');
  const [numberInputValue, setNumberInputValue] = useState('');
  const [dateInputValue, setDateInputValue] = useState('2026-09-30');
  const [timeInputValue, setTimeInputValue] = useState('09:00');
  const [amountInputValue, setAmountInputValue] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [periodFrom, setPeriodFrom] = useState(DEMO_MONTH);
  const [periodTo, setPeriodTo] = useState(DEMO_MONTH);
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [checkboxOn, setCheckboxOn] = useState(true);
  const [checkboxOff, setCheckboxOff] = useState(false);
  const [toneValue, setToneValue] = useState<string>(SERVICE_TONES[0]);
  const [chipValue, setChipValue] = useState('1');
  const [choiceValue, setChoiceValue] = useState('09:00');
  const [radioValue, setRadioValue] = useState('cash');
  const [tagInputTags, setTagInputTags] = useState(['Lactate', 'Nuci']);

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
          <Button variant="link">Link</Button>
          <Button variant="danger">Danger</Button>
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
        <DemoRow label="tone (card cu ton dinamic, ex. Dashboard „De văzut”)">
          <span style={{ color: 'var(--pink-ink)' }}>
            <Button variant="link" tone="inherit">
              Vezi lista →
            </Button>
          </span>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SelectableTile"
        importLine="import { SelectableTile } from '@shared/ui';"
        reference="COMPONENTE.md §0i — hit-area pe toată o placă custom (ChildTile, GroupTile, pool/WeekView…)"
      >
        <DemoRow label="control">
          <SelectableTile aria-label="Maria Ionescu: prezentă" className={styles.selectableTileDemo} onClick={() => {}}>
            Maria Ionescu
          </SelectableTile>
          <SelectableTile
            aria-label="Grupa Mars: selectată"
            selected
            className={styles.selectableTileDemo}
            onClick={() => {}}
          >
            Grupa Mars (selectată)
          </SelectableTile>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SelectableRow"
        importLine="import { SelectableRow } from '@shared/ui';"
        reference="COMPONENTE.md §0i — hit-area pe tot rândul dintr-o listă custom (AssignPage, NotifyPage, ReviewPage…)"
      >
        <DemoRow label="control">
          <SelectableRow aria-label="Rând listă" className={styles.selectableRowDemo} onClick={() => {}}>
            Rândul din listă — hit-area pe tot rândul
          </SelectableRow>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="IconButton"
        importLine="import { IconButton } from '@shared/ui';"
        reference="DS Componente.dc.html §28a — × 36 rotund (închidere) / ⋯ 32 radius 10"
      >
        <DemoRow label="size">
          <IconButton icon="close" ariaLabel="Închide" size="lg" onClick={() => {}} />
          <IconButton icon="more-horizontal" ariaLabel="Mai multe acțiuni" size="sm" onClick={() => {}} />
        </DemoRow>
        <DemoRow label="disabled">
          <IconButton icon="close" ariaLabel="Închide" size="lg" disabled onClick={() => {}} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="StatusIconButton"
        importLine="import { StatusIconButton } from '@shared/ui';"
        reference="Prezența → Luna (18b) — celulă clicabilă cu AttendanceDot, nu o iconiță Lucide"
      >
        <DemoRow label="control">
          <StatusIconButton ariaLabel="12 septembrie: prezent" onClick={() => {}}>
            <AttendanceDot kind="present" />
          </StatusIconButton>
        </DemoRow>
        <DemoRow label="fără conținut (bară poziționată, ex. Concedii)">
          <StatusIconButton ariaLabel="Concediu 1-15 iulie" style={{ width: 80 }} onClick={() => {}} />
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
        name="NumberInput"
        importLine="import { NumberInput } from '@shared/ui';"
        reference="COMPONENTE.md §0/25b — TextInput fără săgeți native, cifre aliniate · Achitare nouă 15b (Sumă pe metode, repartizare manuală)"
      >
        <DemoRow label="control">
          <NumberInput value={numberInputValue} onChange={setNumberInputValue} ariaLabel="Sumă" suffix="lei" />
        </DemoRow>
        <DemoRow label="invalid">
          <NumberInput value="abc" onChange={() => {}} ariaLabel="Sumă" invalid />
        </DemoRow>
        <DemoRow label="disabled">
          <NumberInput value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Select"
        importLine="import { Select } from '@shared/ui';"
        reference="COMPONENTE.md §0/25b — aceeași cutie ca TextInput + ▾, 2–8 opțiuni · Copil nou/Editează 2a (Relație, Statut, Monedă)"
      >
        <DemoRow label="control">
          <Select
            value={selectRelationValue}
            onChange={setSelectRelationValue}
            options={[
              { value: 'mama', label: 'Mamă' },
              { value: 'tata', label: 'Tată' },
              { value: 'bunica', label: 'Bunică' },
            ]}
            placeholder="—"
            ariaLabel="Relație"
          />
        </DemoRow>
        <DemoRow label="invalid">
          <Select value="" onChange={() => {}} options={[{ value: 'mdl', label: 'MDL' }]} ariaLabel="Monedă" invalid />
        </DemoRow>
        <DemoRow label="disabled">
          <Select
            value=""
            onChange={() => {}}
            options={[{ value: 'mdl', label: 'MDL' }]}
            ariaLabel="Câmp dezactivat"
            disabled
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="PhoneInput"
        importLine="import { PhoneInput } from '@shared/ui';"
        reference="COMPONENTE.md §0/25b — validează cu normalizeMoldovanPhone, „✓ +373 …” sub câmp · Copil nou/Editează 2a/2b (telefon părinte)"
      >
        <DemoRow label="control">
          <PhoneInput
            value={phoneInputValue}
            onChange={setPhoneInputValue}
            placeholder="069123456"
            ariaLabel="Telefon"
          />
        </DemoRow>
        <DemoRow label="valid">
          <PhoneInput value="069123456" onChange={() => {}} ariaLabel="Telefon" />
        </DemoRow>
        <DemoRow label="invalid">
          <PhoneInput value="123" onChange={() => {}} ariaLabel="Telefon" />
        </DemoRow>
        <DemoRow label="disabled">
          <PhoneInput value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="FileInput"
        importLine="import { FileInput } from '@shared/ui';"
        reference="COMPONENTE.md §0/25b — zonă punctată, click sau drag & drop · Backup și setări 16a (logo grădiniță)"
      >
        <DemoRow label="gol">
          <FileInput
            ariaLabel="Logo grădiniță"
            accept="image/*"
            onSelect={file => setFileInputValue(URL.createObjectURL(file))}
            placeholder={<span>G</span>}
          />
        </DemoRow>
        <DemoRow label="cu previzualizare">
          <FileInput
            ariaLabel="Logo grădiniță"
            accept="image/*"
            value={fileInputValue || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>'}
            onSelect={file => setFileInputValue(URL.createObjectURL(file))}
            onClear={() => setFileInputValue('')}
            placeholder={<span>G</span>}
          />
        </DemoRow>
        <DemoRow label="dezactivat">
          <FileInput ariaLabel="Câmp dezactivat" onSelect={() => {}} placeholder={<span>G</span>} disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="DateInput"
        importLine="import { DateInput } from '@shared/ui';"
        reference="COMPONENTE.md §0/25b — afișare zz.ll.aaaa, `trailing` opțional · Achitare nouă 15b (Data)"
      >
        <DemoRow label="control">
          <DateInput value={dateInputValue} onChange={setDateInputValue} ariaLabel="Data" />
        </DemoRow>
        <DemoRow label="cu trailing">
          <DateInput value="2020-01-01" onChange={() => {}} ariaLabel="Data nașterii" trailing="4 ani" />
        </DemoRow>
        <DemoRow label="invalid">
          <DateInput value="" onChange={() => {}} ariaLabel="Data" invalid />
        </DemoRow>
        <DemoRow label="disabled">
          <DateInput value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="MonthInput"
        importLine="import { MonthInput } from '@shared/ui';"
        reference="DS Componente formular.dc.html §25b — variantă lună (Perioadă, Raport)"
      >
        <DemoRow label="control">
          <MonthInput value="2026-09" onChange={() => {}} ariaLabel="Luna" />
        </DemoRow>
        <DemoRow label="invalid">
          <MonthInput value="" onChange={() => {}} ariaLabel="Luna" invalid />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="TimeInput"
        importLine="import { TimeInput } from '@shared/ui';"
        reference="COMPONENTE.md §0e/30c — aceeași formă ca DateInput · Bazin (Program), Vizite, Notificări (Ora rezumatului)"
      >
        <DemoRow label="control">
          <TimeInput value={timeInputValue} onChange={setTimeInputValue} ariaLabel="Ora" />
        </DemoRow>
        <DemoRow label="invalid">
          <TimeInput value="" onChange={() => {}} ariaLabel="Ora" invalid />
        </DemoRow>
        <DemoRow label="disabled">
          <TimeInput value="" onChange={() => {}} ariaLabel="Câmp dezactivat" disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="AmountInput"
        importLine="import { AmountInput } from '@shared/ui';"
        reference="COMPONENTE.md §2, id 25d — Baloo 40 (36 în dialog) + monedă, caset orange/cream · Achitare nouă 15b (Sumă)"
      >
        <DemoRow label="control">
          <AmountInput value={amountInputValue} onChange={setAmountInputValue} ariaLabel="Sumă" currency="lei" />
        </DemoRow>
        <DemoRow label="cu shortcuts">
          <AmountInput
            value="3000"
            onChange={() => {}}
            ariaLabel="Sumă"
            currency="lei"
            shortcuts={
              <>
                <button type="button">1 lună · 1.500</button>
                <button type="button">2 luni · 3.000</button>
              </>
            }
          />
        </DemoRow>
        <DemoRow label="dialog (36px)">
          <AmountInput value="9600" onChange={() => {}} ariaLabel="Sumă" currency="lei" size="dialog" />
        </DemoRow>
        <DemoRow label="disabled">
          <AmountInput value="" onChange={() => {}} ariaLabel="Câmp dezactivat" currency="lei" disabled />
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
        name="ChipSelect"
        importLine="import { ChipSelect } from '@shared/ui';"
        reference="COMPONENTE.md §2, id 22b — pastile de alegere unică · Bazin, Programare nouă (Ziua)"
      >
        <DemoRow label="control">
          <ChipSelect
            ariaLabel="Ziua"
            value={chipValue}
            onChange={setChipValue}
            options={[
              { value: '1', label: 'Lu' },
              { value: '2', label: 'Ma' },
              { value: '3', label: 'Mi' },
              { value: '4', label: 'Jo' },
              { value: '5', label: 'Vi' },
            ]}
          />
        </DemoRow>
        <DemoRow label="disabled">
          <ChipSelect
            ariaLabel="Opțiune dezactivată"
            value=""
            onChange={() => {}}
            options={[{ value: 'x', label: 'Indisponibil', disabled: true }]}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ChoiceCards"
        importLine="import { ChoiceCards } from '@shared/ui';"
        reference="COMPONENTE.md §2, id 22b — carduri selectabile, `disabled` pentru ora plină · Bazin, Programare nouă (Ora)"
      >
        <DemoRow label="control">
          <ChoiceCards
            ariaLabel="Ora"
            value={choiceValue}
            onChange={setChoiceValue}
            options={[
              { value: '09:00', title: '09:00', sub: '2 copii' },
              { value: '09:30', title: '09:30', sub: '0 copii' },
              { value: '10:00', title: '10:00', sub: '4 copii', disabled: true },
            ]}
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
        name="PeriodFilter"
        importLine="import { PeriodFilter } from '@shared/ui';"
        reference="DS Tabel si filtre.dc.html §27e — varianta minimă (interval de luni), folosită azi de Achitări; presetările rămân pentru ecranul care le va folosi prima dată"
      >
        <DemoRow label="control">
          <PeriodFilter from={periodFrom} to={periodTo} onFromChange={setPeriodFrom} onToChange={setPeriodTo} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ActiveFilters"
        importLine="import { ActiveFilters } from '@shared/ui';"
        reference="DS Tabel si filtre.dc.html §27a — „Cheie: valoare ×” + „Șterge filtrele”, randat doar cât e activ cel puțin un filtru"
      >
        <DemoRow label="control">
          <ActiveFilters
            filters={[
              { key: 'method', label: 'Metodă: Cash', onClear: () => {} },
              { key: 'group', label: 'Grupa: Curcubeu', onClear: () => {} },
            ]}
            onReset={() => {}}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="FilterMenu"
        importLine="import { FilterMenu } from '@shared/ui';"
        reference="DS Tabel si filtre.dc.html §27e — meniu de filtrare peste Popover"
      >
        <DemoRow label="control">
          <FilterMenu
            label="Metodă"
            options={[
              { value: 'cash', label: 'Cash', count: 12 },
              { value: 'card', label: 'Card', count: 4 },
            ]}
            selected={['cash']}
            onChange={() => {}}
          />
        </DemoRow>
        <DemoRow label="contoare în schelet">
          <FilterMenu
            label="Grupă"
            options={[{ value: 'a', label: 'Grupa mare' }]}
            selected={[]}
            onChange={() => {}}
            countsLoading
          />
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

      <ComponentShowcase
        name="RadioGroup"
        importLine="import { RadioGroup } from '@shared/ui';"
        reference="DS Componente formular.dc.html — selecție unică, listă verticală"
      >
        <DemoRow label="control">
          <RadioGroup
            name="demo-radio"
            ariaLabel="Metodă"
            value={radioValue}
            onChange={setRadioValue}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'transfer', label: 'Transfer', disabled: true },
            ]}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="MultiSelect"
        importLine="import { MultiSelect } from '@shared/ui';"
        reference="DS Componente 2.dc.html §34j — chip-uri, selecție multiplă dintr-o listă fixă (v1: fără căutare/spinner și fără acțiune de grup în subsol)"
      >
        <DemoRow label="control">
          <MultiSelect
            ariaLabel="Grupe"
            placeholder="Alege grupe…"
            selected={['a']}
            onChange={() => {}}
            options={[
              { value: 'a', label: 'Grupa Mari' },
              { value: 'b', label: 'Grupa Mici' },
              { value: 'c', label: 'Grupa Mijlocii' },
            ]}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="FormSection"
        importLine="import { FormSection } from '@shared/ui';"
        reference="DS-IMPLEMENTARE.md §3 — structură de formular, grupare de câmpuri cu titlu"
      >
        <DemoRow label="control">
          <FormSection title="Date de contact" description="Folosite pentru notificări SMS.">
            <p>Câmpurile formularului ar veni aici.</p>
          </FormSection>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="FormGrid"
        importLine="import { FormGrid } from '@shared/ui';"
        reference="DS-IMPLEMENTARE.md §3 — structură de formular, grilă responzivă de câmpuri"
      >
        <DemoRow label="control">
          <FormGrid>
            <div>Câmp 1</div>
            <div>Câmp 2</div>
          </FormGrid>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="InlineEdit"
        importLine="import { InlineEdit } from '@shared/ui';"
        reference="COMPONENTE.md §0i, 34d — editare directă pe clic"
      >
        <DemoRow label="control">
          <InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={() => {}} />
        </DemoRow>
        <DemoRow label="gol (placeholder)">
          <InlineEdit ariaLabel="Poreclă" value="" onSave={() => {}} placeholder="Fără poreclă" />
        </DemoRow>
        <DemoRow label="disabled">
          <InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={() => {}} disabled />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="TagInput"
        importLine="import { TagInput } from '@shared/ui';"
        reference="DS Diverse.dc.html §32g — alergii, taguri libere introduse de utilizator"
      >
        <DemoRow label="control">
          <TagInput
            ariaLabel="Alergii"
            placeholder="Adaugă o alergie…"
            tags={tagInputTags}
            onChange={setTagInputTags}
          />
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}
