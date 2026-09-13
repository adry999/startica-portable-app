// Fațadă păstrată pentru compatibilitate; codul a fost mutat în src/core/server (pasul 4 din plan).
export { sendResponse as send } from '#core/server/http/json-response.mjs';
export {
  assertAllowedRequest as guardRequest,
  assertAuthorizedWrite as guardWrite,
  readJsonBody as readJson,
} from '#core/server/http/request-guards.mjs';
export {
  importMapHashes,
  isStaticAsset as isStatic,
  isBrowserModule as isModule,
  sendBrowserModule as sendModule,
  sendStaticAsset as sendStatic,
} from '#core/server/http/static-assets.mjs';
