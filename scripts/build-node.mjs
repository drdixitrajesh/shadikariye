process.env.NODE_ENV = 'production';
const { createBuilder } = await import('vite');
const builder = await createBuilder({ configFile: 'vite.node.config.ts' });
await builder.buildApp();
