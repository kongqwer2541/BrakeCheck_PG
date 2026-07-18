import assert from 'node:assert/strict';
import test from 'node:test';

const { withPostgresTransaction } = await import('./postgres-transaction.js');

test('commits successful PostgreSQL work and releases the client', async () => {
  const queries = [];
  let releaseArgument = 'not-released';
  const client = {
    query: async (sql) => {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release: (error) => {
      releaseArgument = error;
    }
  };
  const pool = {
    connect: async () => client
  };

  const result = await withPostgresTransaction(pool, async () => 'saved');

  assert.equal(result, 'saved');
  assert.deepEqual(queries, ['BEGIN', 'COMMIT']);
  assert.equal(releaseArgument, undefined);
});

test('preserves the original error and discards a client when rollback fails', async () => {
  const originalError = new Error('original failure');
  const rollbackError = new Error('rollback failure');
  let releaseArgument;
  const client = {
    query: async (sql) => {
      if (sql === 'ROLLBACK') {
        throw rollbackError;
      }
      return { rows: [], rowCount: 0 };
    },
    release: (error) => {
      releaseArgument = error;
    }
  };
  const pool = {
    connect: async () => client
  };

  await assert.rejects(
    () => withPostgresTransaction(pool, async () => {
      throw originalError;
    }),
    (error) => error === originalError
  );

  assert.equal(releaseArgument, rollbackError);
});
