/**
 * harness-exit.ts — the shared, non-blocking end-of-run for every server harness.
 *
 * WHY: the MJ SQLServerDataProvider pool's `await pool.close()` can hang indefinitely (lingering
 * socket handles), so a harness that ends with `await pool.close(); process.exit()` may print its
 * summary and then NEVER reach the exit — the tsx process lingers forever. The rule: NEVER `await`
 * a pool close before exiting. Kick the close off non-blocking and force-exit; dropped sockets are
 * harmless for a test harness (SQL Server reaps them).
 *
 * Use `finishAndExit(...)` at the end of `main()` AND on the bootstrap-error path.
 */
import type sql from 'mssql';

/**
 * Print the summary line, fire-and-forget close every pool (never awaited), and force-exit.
 * @param summaryLine the `────── Block N runtime: X/Y passed ──────` line to print.
 * @param exitCode 0 = all passed, 1 = test failures, 2 = bootstrap error.
 * @param pools the pools to close non-blocking (skip any undefined ones, dedupe identical refs).
 */
export function finishAndExit(summaryLine: string, exitCode: number, ...pools: Array<sql.ConnectionPool | undefined>): never {
  console.log(summaryLine);
  const seen = new Set<sql.ConnectionPool>();
  for (const pool of pools) {
    if (!pool || seen.has(pool)) continue;
    seen.add(pool);
    void pool.close().catch(() => { /* dropped sockets are fine for a test harness */ });
  }
  process.exit(exitCode);
}
