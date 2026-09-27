/**
 * Record persisted LKGP pins after a combo target succeeds.
 *
 * Non-blocking by design: the fallback loop never waits on these SQLite
 * writes. A failed write is not silent — it logs a warning carrying the
 * combo, the execution key and the provider. The returned promise never
 * rejects: routing callers ignore it, tests await it.
 */

type WarnLogger = { warn?: (tag: string, msg: string, data?: unknown) => void } | null;
type SetLkgp = (
  comboName: string,
  modelKey: string,
  provider: string,
  connectionId?: string
) => Promise<void>;

async function writePins(
  comboName: string,
  executionKey: string | null | undefined,
  comboId: string | null | undefined,
  provider: string,
  connectionId: string | undefined,
  setLKGPFn: SetLkgp | undefined
): Promise<void> {
  const set = setLKGPFn ?? (await import("@/lib/db/settings")).setLKGP;
  const comboKey = comboId || comboName;
  const pending: Promise<void>[] = executionKey
    ? [set(comboName, executionKey, provider, connectionId)]
    : [];
  pending.push(set(comboName, comboKey, provider, connectionId));
  await Promise.all(pending);
}

export function recordLkgpPin(opts: {
  comboName: string;
  executionKey: string | null | undefined;
  comboId: string | null | undefined;
  provider: string;
  connectionId: string | undefined;
  log?: WarnLogger;
  tag?: string;
  /** Test seam; the routing path always resolves the writer from @/lib/db/settings. */
  setLKGP?: SetLkgp;
}): Promise<void> {
  const { comboName, executionKey, comboId, provider, connectionId } = opts;
  const log = opts.log;
  const tag = opts.tag ?? "COMBO";
  const setLKGP = opts.setLKGP;
  return writePins(comboName, executionKey, comboId, provider, connectionId, setLKGP).catch(
    (err: unknown) => {
      log?.warn?.(tag, "Failed to record Last Known Good Provider. This is non-fatal.", {
        combo: comboName,
        comboId: comboId ?? null,
        executionKey: executionKey ?? null,
        provider,
        connectionId: connectionId ?? null,
        err,
      });
    }
  );
}
