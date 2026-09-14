import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '#app/server/main.mjs';

export { createApplication } from '#app/server/create-application.mjs';

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  startServer();
}
