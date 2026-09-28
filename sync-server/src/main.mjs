import { loadSyncConfig } from './config.mjs';
import { createSyncServer } from './create-sync-server.mjs';

const config = loadSyncConfig();
const { server, close } = createSyncServer({ config });

server.listen(config.port, config.bind, () => {
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  console.log(`Serverul de sincronizare ascultă pe http://${config.bind}:${address.port} (date în ${config.dataDir}).`);
});

// close() din createSyncServer (nu server.close): închide fluxurile SSE și forțează
// socket-urile rămase (closeAllConnections) înainte de a opri, altfel un flux SSE deschis
// blochează server.close() la nesfârșit — Docker trimite SIGKILL după 10 s (D-5).
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    close().then(() => process.exit(0));
  });
