// Semințele Personal 24 (întrebarea 2 din plan, răspuns acceptat): scrise o singură
// dată, la prima deschidere a bazei comune, cât timp „departments” și „roles” sunt
// amândouă goale — apoi rămân editabile din 23e, fără nicio rescriere automată.

/** @type {import('../personal.types.d.mts').PersonalSettings} */
export const DEFAULT_PERSONAL_SETTINGS = { annualLeaveDays: 28, deductOnlyUnexcused: true };

/** @returns {import('../personal.types.d.mts').Department[]} */
export function seedDepartments() {
  return [
    { id: 'DEP-administratie', name: 'Administrație', order: 0 },
    { id: 'DEP-educatori', name: 'Educatori', order: 1 },
    { id: 'DEP-bucatarie', name: 'Bucătărie', order: 2 },
    { id: 'DEP-altele', name: 'Altele', order: 3 },
  ];
}

/** @returns {import('../personal.types.d.mts').Role[]} */
export function seedRoles() {
  return [
    { id: 'ROL-director', name: 'Director', departmentId: 'DEP-administratie', order: 0 },
    { id: 'ROL-administrator', name: 'Administrator', departmentId: 'DEP-administratie', order: 1 },
    { id: 'ROL-educator', name: 'Educator', departmentId: 'DEP-educatori', order: 0 },
    { id: 'ROL-asistent-educator', name: 'Asistent educator', departmentId: 'DEP-educatori', order: 1 },
    { id: 'ROL-bucatar', name: 'Bucătar', departmentId: 'DEP-bucatarie', order: 0 },
    { id: 'ROL-menajera', name: 'Menajeră', departmentId: 'DEP-altele', order: 0 },
    { id: 'ROL-antrenor-bazin', name: 'Antrenor bazin', departmentId: 'DEP-altele', order: 1 },
  ];
}

// Rolul dedicat antrenorilor de bazin: Pool (Faza 5, nu în această livrare) îl citește prin
// portul listCoaches() injectat, ca personal să nu importe pool și nici invers.
export const POOL_COACH_ROLE_ID = 'ROL-antrenor-bazin';
