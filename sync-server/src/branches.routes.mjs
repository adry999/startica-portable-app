import { fail } from './router.mjs';

const NAME_MAX_LENGTH = 120;
const COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

/** @param {unknown} value @param {number} maxLength */
function readRequiredText(value, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) return undefined;
  return value.trim();
}

/**
 * @param {{ branches: ReturnType<typeof import('./branches.repository.mjs').createBranchesRepository>, devices: ReturnType<typeof import('./devices.repository.mjs').createDevicesRepository>, now: () => Date }} dependencies
 */
export function createBranchesRoutes({ branches, devices, now }) {
  function list() {
    return {
      branches: branches.list().map(branch => ({
        id: branch.id,
        name: branch.name,
        color: branch.color,
        address: branch.address,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      })),
    };
  }

  /** @param {{ id?: string, name?: string, color?: string, address?: string, createdAt?: string }} body @param {{ id: string }} device */
  function register(body, device) {
    const id = readRequiredText(body?.id, NAME_MAX_LENGTH);
    const name = readRequiredText(body?.name, NAME_MAX_LENGTH);
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const color = typeof body?.color === 'string' && COLOR_PATTERN.test(body.color) ? body.color : undefined;
    const createdAt = readRequiredText(body?.createdAt, 40);
    if (!id || !name || !color || !createdAt) fail('Filiala trebuie să aibă id, nume, culoare și dată de creare.', 400);

    devices.touchLastSeen(device.id, { branchId: id, now: now().toISOString() });
    return branches.register({
      id,
      name,
      color,
      address,
      createdAt,
      updatedAt: createdAt,
      uploadedBy: device.id,
      now: now().toISOString(),
    });
  }

  /** @type {import('./router.mjs').RouteDefinition[]} */
  const routes = [
    { method: 'GET', pattern: /^\/v1\/branches$/, auth: true, handle: () => list() },
    {
      method: 'POST',
      pattern: /^\/v1\/branches$/,
      auth: true,
      handle: ({ body, device }) =>
        register(
          /** @type {{ id?: string, name?: string, color?: string, address?: string, createdAt?: string }} */ (body),
          /** @type {{ id: string }} */ (device),
        ),
    },
  ];
  return { routes };
}
