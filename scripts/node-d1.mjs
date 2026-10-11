import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';

// The app uses the D1 statement API; keep SQL and stored password/photo formats.
export function createDatabase(path) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
  function statement(sql, values = []) {
    const parameters = values.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value);
    function execute() {
      const start = performance.now();
      const query = sqlite.prepare(sql);
      const returnsRows = query.columns().length > 0;
      const results = returnsRows ? query.all(...parameters).map(row => ({ ...row })) : [];
      const mutation = returnsRows ? sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get() : query.run(...parameters);
      const readOnly = /^\s*(SELECT|PRAGMA|EXPLAIN)\b/i.test(sql);
      return { success: true, results, meta: {
        changes: readOnly ? 0 : Number(mutation.changes),
        last_row_id: Number(mutation.lastInsertRowid ?? mutation.last_row_id),
        duration: performance.now() - start,
      } };
    }
    return {
      bind: (...args) => statement(sql, args),
      async all() { return execute(); },
      async run() { return execute(); },
      async first(column) {
        const row = execute().results[0];
        return row ? (column === undefined ? row : row[column]) : null;
      },
      async raw({ columnNames = false } = {}) {
        const rows = execute().results;
        const names = sqlite.prepare(sql).columns().map(column => column.name);
        const raw = rows.map(row => names.map(name => row[name]));
        return columnNames ? [names, ...raw] : raw;
      },
      execute,
    };
  }
  return {
    prepare: sql => statement(sql),
    async batch(statements) {
      // No await inside the transaction: overlapping requests cannot interleave.
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(query => query.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    async exec(sql) { const start = performance.now(); sqlite.exec(sql); return { count: 1, duration: performance.now() - start }; },
    close: () => sqlite.close(),
  };
}
