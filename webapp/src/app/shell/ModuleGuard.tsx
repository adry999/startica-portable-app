import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { PinGate } from '@shared/app/PinGate';
import { EMPTY_STATES, EmptyState, resolveEmptyStateText, resolveEmptyStateTitle } from '@shared/ui';
import {
  completProfile,
  firstAllowedModule,
  isModuleAllowed,
  MODULE_LABELS,
  PRESET_LABELS,
  requiresPin,
} from '#shared/domain/computer-profile.mjs';
import { VIEW_LABELS } from './nav-items';
import { VIEW_PATHS } from './routes';
import { MODULE_FIRST_VIEW } from './view-modules';

export interface ModuleGuardProps {
  /** Modulul canonic (`computer-profile.mjs`, `MODULE_IDS`) care guvernează ruta înconjurată. */
  moduleId: string;
  children: ReactNode;
}

/**
 * Singurul punct din router care verifică profilul calculatorului (§5.3, 36f,
 * `docs/design/screens/31-profiluri-calculator.md`): o rută din afara profilului arată starea
 * goală `profil.blocked` în loc de conținutul real. Nu e o a doua graniță de securitate — serverul
 * local (`route-modules.mjs`/`route-dispatcher.mjs`) respinge oricum cu 403 orice cerere pentru un
 * modul neinclus în profil; aici e doar vizibilitate/UX peste acea graniță deja impusă.
 *
 * Nu șterge și nu atinge nicio dată locală (decizia 02.10, RASPUNSURI-02-10.md #6) — doar ascunde.
 *
 * §4 (PROMPT-CLAUDE-CODE-10.md, screens/31-profiluri-calculator.md): tot aici, după ce modulul e
 * permis, se verifică `requiresPin` — modulul e în `profile.pinModules` (bifa „PIN la intrare” din
 * ProfileEditor). E singurul loc unde se face asta la nivel de rută; Salarii (`features/personal`)
 * își păstrează propriul `PinGate` hardcodat (decizia 23d — mereu protejate, indiferent de profil),
 * care poate ajunge înfășurat și de acesta când `personal` e bifat — fără prompt dublu, cele două
 * citesc aceeași stare de deblocare de pe server (`usePinStatus`/`/api/personal/pin`).
 */
export function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const session = useAppSession();
  const navigate = useNavigate();
  const profile = session.state.profile ?? completProfile();

  const moduleLabels: Record<string, string> = MODULE_LABELS;

  if (isModuleAllowed(profile, moduleId)) {
    if (requiresPin(profile, moduleId)) {
      return <PinGate label={moduleLabels[moduleId] ?? 'acest modul'}>{children}</PinGate>;
    }
    return <>{children}</>;
  }

  const presetLabels: Record<string, string> = PRESET_LABELS;
  const params = {
    modul: moduleLabels[moduleId] ?? 'acest modul',
    profil: presetLabels[profile.preset] ?? profile.preset,
  };
  const targetModule = firstAllowedModule(profile);
  const targetView = targetModule ? MODULE_FIRST_VIEW[targetModule] : null;
  const entry = EMPTY_STATES['profil.blocked'];

  return (
    <EmptyState
      variant={entry.variant}
      title={resolveEmptyStateTitle(entry, params)}
      description={resolveEmptyStateText(entry, params)}
      action={
        targetView
          ? { label: `Mergi la ${VIEW_LABELS[targetView]}`, onClick: () => navigate(VIEW_PATHS[targetView]) }
          : undefined
      }
    />
  );
}
