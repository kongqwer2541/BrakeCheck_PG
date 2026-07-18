export async function withPostgresTransaction(pool, callback) {
  const client = await pool.connect();
  let releaseError;

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      releaseError = rollbackError;
    }

    throw error;
  } finally {
    client.release(releaseError);
  }
}
