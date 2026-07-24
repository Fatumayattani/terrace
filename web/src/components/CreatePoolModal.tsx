import { useState } from "react";
import type { Address, WalletClient } from "viem";
import { createPool } from "../chain";
import { CONFIG } from "../config";

export function CreatePoolModal({
  account,
  wallet,
  onClose,
  onCreated,
  onNotice,
  onNeedWallet,
}: {
  account: Address | null;
  wallet: WalletClient | null;
  onClose: () => void;
  onCreated: () => void;
  onNotice: (s: string) => void;
  onNeedWallet: () => void;
}) {
  const [matchId, setMatchId] = useState("wc2026-final-2026-07-19");
  const [title, setTitle] = useState("Final · MetLife Stadium");
  const [outcomes, setOutcomes] = useState("Home win, Draw after 90, Away win");
  const [entry, setEntry] = useState("5");
  const [lockLocal, setLockLocal] = useState(() => {
    const d = new Date(Date.now() + 6 * 3600 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (CONFIG.demoMode) {
      onNotice("Demo mode: deploy TerracePool and set VITE_POOL_ADDRESS to open real pools.");
      return;
    }
    if (!wallet || !account) {
      onNeedWallet();
      return;
    }
    const outcomeList = outcomes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (outcomeList.length < 2) {
      onNotice("A pool needs at least two outcomes.");
      return;
    }
    const entryAmount = BigInt(Math.round(parseFloat(entry) * 1_000_000));
    const lockTime = BigInt(Math.floor(new Date(lockLocal).getTime() / 1000));
    if (lockTime <= BigInt(Math.floor(Date.now() / 1000))) {
      onNotice("Lock time must be in the future, ideally kickoff.");
      return;
    }

    setBusy(true);
    try {
      const tx = await createPool(wallet, account, matchId, title, outcomeList, entryAmount, lockTime);
      onNotice(`Pool open: ${tx.slice(0, 14)}…`);
      onCreated();
    } catch (err) {
      onNotice(`Create failed: ${(err as Error).message.split("\n")[0]}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Open a pool" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Open a pool</h2>
          <button className="notice-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label className="field">
          <span>Match ID</span>
          <input value={matchId} onChange={(e) => setMatchId(e.target.value)} className="mono" />
          <small>The oracle's key for this match. List them at the oracle's /matches route.</small>
        </label>

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="field">
          <span>Outcomes, comma separated</span>
          <input value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
          <small>Keep home / draw / away order so the oracle's outcome index maps directly.</small>
        </label>

        <div className="field-row">
          <label className="field">
            <span>Entry, USDC</span>
            <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" className="mono" />
          </label>
          <label className="field">
            <span>Locks at</span>
            <input
              type="datetime-local"
              value={lockLocal}
              onChange={(e) => setLockLocal(e.target.value)}
              className="mono"
            />
          </label>
        </div>

        <button className="btn btn-amber modal-submit" disabled={busy} onClick={submit}>
          {busy ? "Confirming…" : "Open pool"}
        </button>
      </div>
    </div>
  );
}
