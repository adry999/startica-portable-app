import { loadSyncConfig } from './config.mjs';
import { createSyncServer } from './create-sync-server.mjs';

const config = loadSyncConfig();
const { server } = createSyncServer({ config });

server.listen(config.port, config.bind, () => {
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  console.log(`Serverul de sincronizare ascultă pe http://${config.bind}:${address.port} (date în ${config.dataDir}).`);
});

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
