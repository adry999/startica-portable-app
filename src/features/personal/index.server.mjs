export { createPersonalRepository } from './server/personal.repository.mjs';
export { createLeavesService } from './server/leaves.service.mjs';
export { createPersonalRoutes } from './server/personal.routes.mjs';
export { createCoachPaymentWriter } from './server/salaries.service.mjs';
// §7 (36h): expus la nivel de feature, ca create-branch-context.mjs să poată construi O
// SINGURĂ instanță (nu una ascunsă în salaries.routes.mjs), partajată de orice modul din
// `profile.pinModules`, nu doar de Salarii.
export { createPinService } from './server/pin.service.mjs';
export { POOL_COACH_ROLE_ID } from './domain/personal-seeds.mjs';
export { PERSONAL_KINDS, normalizePersonalRecord } from './domain/personal-schema.mjs';
