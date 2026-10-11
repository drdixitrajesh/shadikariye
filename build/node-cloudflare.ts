// Both bundled server environments share bindings through the process registry.
// Configuration happens before the built application is imported.
export const env: Cloudflare.Env = (globalThis as Record<symbol, unknown>)[Symbol.for('managelove.node.env')] as Cloudflare.Env;
export class DurableObject {}
