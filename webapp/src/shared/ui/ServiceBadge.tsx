import { Badge, type BadgeTone } from './Badge';

export interface ServiceBadgeInput {
  name: string;
  /** Una din cele 8 chei de ton comune cu PillTone/BadgeTone (B3, `Service.tone`). */
  tone: string;
}

/** Tonul pastilei unui serviciu — direct din `service.tone` (COMPONENTE.md §2 „ServiceBadge + serviceTone()"). */
export function serviceTone(service: ServiceBadgeInput): BadgeTone {
  return service.tone as BadgeTone;
}

export interface ServiceBadgeProps {
  service: ServiceBadgeInput;
}

/** Pastila serviciului (Achitări, fișa, Raport contabil, Backup și setări → Servicii) — peste `Badge`. */
export function ServiceBadge({ service }: ServiceBadgeProps) {
  return <Badge tone={serviceTone(service)}>{service.name}</Badge>;
}
