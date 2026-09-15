/** @param {import('../visits.types.mjs').VisitsRoutesDependencies} dependencies */
export function createVisitsRoutes({ visitsService }) {
  return [
    {
      method: 'POST',
      path: '/api/visits-enrol',
      /** @param {{ body: import('../visits.types.mjs').EnrolChildRequest }} request */
      handle: ({ body }) => visitsService.enrolChild({ visitId: body.visitId, child: body.child }, body),
    },
  ];
}
