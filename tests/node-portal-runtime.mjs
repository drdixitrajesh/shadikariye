import { resolve } from 'node:path';
import { createDatabase } from '../scripts/node-d1.mjs';

export async function createNodePortalRuntime({ bindings, outboundService }) {
  const db = createDatabase(':memory:');
  const env = { ...bindings, DB: db };
  globalThis[Symbol.for('managelove.node.env')] = env;
  process.env.NODE_ENV = 'production';
  // The network boundary is mocked only in this isolated test process.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    try { return await outboundService(new Request(url, init)); }
    catch (error) { console.error('Mock outbound failure:', error.message); throw error; }
  };
  const { importServerEntryModule } = await import('vinext/server/prod-server');
  const { default: handler, PortalPasswordService } = await importServerEntryModule(resolve('dist/server/index.js'));
  const service = new PortalPasswordService();
  env.PASSWORD_SERVICE = { idFromName: name => name, get: () => ({ fetch: (url, init) => service.fetch(new Request(url, init)) }) };
  return {
    dispatchFetch: (url, init) => handler(new Request(url, init)),
    getD1Database: async () => db,
    dispose: async () => { db.close(); globalThis.fetch = realFetch; },
  };
}
