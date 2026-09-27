export type StickerTemplateKey = 'nume' | 'alergie' | 'anunt' | 'obiect' | 'liber';

export interface StickerTemplate {
  key: StickerTemplateKey;
  label: string;
  line1: string;
  line2: string;
  line3: string;
  /** Etichetă scurtă arătată deasupra textului mare (ex. „ALERGIE", „ANUNȚ") — gol înseamnă fără. */
  badge: string;
  /** Pictograma Startica nu apare la mărimea 58×30, indiferent de această valoare — vezi StickerLabel. */
  showIcon: boolean;
}

/** Cele 5 modele din 25-bon-stickere.md — fiecare precompletează 3 rânduri, toate editabile. */
export const STICKER_TEMPLATES: Record<StickerTemplateKey, StickerTemplate> = {
  nume: {
    key: 'nume',
    label: 'Nume copil',
    line1: 'Avram Maria',
    line2: 'Grupa Mars',
    line3: 'dulapul 7',
    badge: '',
    showIcon: true,
  },
  alergie: {
    key: 'alergie',
    label: 'Alergie',
    line1: 'Fără arahide',
    line2: 'Avram Maria · Mars',
    line3: 'anunțați educatorul',
    badge: 'ALERGIE',
    showIcon: true,
  },
  anunt: {
    key: 'anunt',
    label: 'Anunț',
    line1: 'Ședința cu părinții',
    line2: 'Joi, 2 octombrie · 18:00',
    line3: 'sala mare',
    badge: 'ANUNȚ',
    showIcon: false,
  },
  obiect: {
    key: 'obiect',
    label: 'Obiect',
    line1: 'Cutia cu plastilină',
    line2: 'Grupa Soare',
    line3: '',
    badge: '',
    showIcon: true,
  },
  liber: {
    key: 'liber',
    label: 'Text liber',
    line1: 'Scrie aici',
    line2: '',
    line3: '',
    badge: '',
    showIcon: false,
  },
};

export const STICKER_TEMPLATE_ORDER: StickerTemplateKey[] = ['nume', 'alergie', 'anunt', 'obiect', 'liber'];

export type StickerDecor = 'cercuri' | 'chenar' | 'simplu';

export const STICKER_DECOR_OPTIONS: { value: StickerDecor; label: string }[] = [
  { value: 'cercuri', label: 'Cercuri' },
  { value: 'chenar', label: 'Chenar' },
  { value: 'simplu', label: 'Simplu' },
];

export interface StickerSizeOption {
  value: import('./sticker-text-fit').StickerLabelSize;
  label: string;
}

export const STICKER_SIZE_OPTIONS: StickerSizeOption[] = [
  { value: '58x30', label: '58 × 30' },
  { value: '58x40', label: '58 × 40' },
  { value: '58x60', label: '58 × 60' },
];
