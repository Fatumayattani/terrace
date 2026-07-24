import { useState } from "react";
import type { Address, WalletClient } from "viem";
import { claimPool, joinPool, type PoolView } from "../chain";
import { CONFIG, formatUSDC } from "../config";

const STATUS_LABEL = ["OPEN", "LOCKED", "FULL TIME", "VOIDED"] as const;

export function TicketCard({
  pool,
  account,
  wallet,
  onChanged,
  onNotice,
  onNeedWallet,
}: {
  pool: PoolView;
  account: Address | null;
  wallet: WalletClient | null;
  onChanged: () => void;
  onNotice: (s: string) => void;
  onNeedWallet: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const now = Math.floor(Date.now() / 1000);
  const locked = pool.status !== 0 || Number(pool.lockTime) <= now;
  const settled = pool.status === 2;
  const voided = pool.status === 3;
  const effectiveStatus = settled || voided ? pool.status : locked ? 1 : 0;

  const totalEntries = pool.outcomeEntries.reduce((a, b) => a + b, 0n);

  const join = async () => {
    if (picked === null) return;
    if (CONFIG.demoMode) {
      onNotice("Demo mode: deploy TerracePool and set VITE_POOL_ADDRESS to stake for real.");
      return;
    }
    if (!wallet || !account) {
      onNeedWallet();
      return;
    }
    setBusy(true);
    try {
      const tx = await joinPool(wallet, account, pool.id, picked, 1n, pool.entryAmount);
      onNotice(`You're in. Entry confirmed: ${tx.slice(0, 14)}…`);
      setPicked(null);
      onChanged();
    } catch (err) {
      onNotice(`Entry failed: ${(err as Error).message.split("\n")[0]}`);
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (CONFIG.demoMode) {
      onNotice("Demo mode: claims work once the contract is deployed.");
      return;
    }
    if (!wallet || !account) {
      onNeedWallet();
      return;
    }
    setBusy(true);
    try {
      const tx = await claimPool(wallet, account, pool.id);
      onNotice(`Winnings claimed: ${tx.slice(0, 14)}…`);
      onChanged();
    } catch (err) {
      onNotice(`Claim failed: ${(err as Error).message.split("\n")[0]}`);
    } finally {
      setBusy(false);
    }
  };

  const lockDate = new Date(Number(pool.lockTime) * 1000);

  return (
    <article className={`ticket status-${effectiveStatus}`}>
      <div className="ticket-stub" aria-hidden="true">
        <span className="stub-label">POT</span>
        <span className="stub-pot mono">{formatUSDC(pool.pot)}</span>
        <span className="stub-unit">USDC</span>
      </div>

      <div className="ticket-body">
        <div className="ticket-head">
          <h2 className="ticket-title">{pool.title}</h2>
          <span className={`stamp stamp-${effectiveStatus}`}>{STATUS_LABEL[effectiveStatus]}</span>
        </div>
        <div className="ticket-meta mono">
          <span>#{pool.id.toString().padStart(3, "0")}</span>
          <span>·</span>
          <span>{formatUSDC(pool.entryAmount)} USDC an entry</span>
          <span>·</span>
          <span>
            {effectiveStatus === 0 ? "locks" : "locked"}{" "}
            {lockDate.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="outcomes" role={effectiveStatus === 0 ? "radiogroup" : undefined}>
          {pool.outcomes.map((label, i) => {
            const entries = pool.outcomeEntries[i] ?? 0n;
            const share = totalEntries > 0n ? Number((entries * 100n) / totalEntries) : 0;
            const isWinner = settled && pool.winningOutcome === i;
            const isPicked = picked === i;
            return (
              <button
                key={i}
                className={`outcome ${isPicked ? "picked" : ""} ${isWinner ? "winner" : ""}`}
                disabled={effectiveStatus !== 0 || busy}
                aria-pressed={isPicked}
                onClick={() => setPicked(isPicked ? null : i)}
              >
                <span className="outcome-bar" style={{ width: `${share}%` }} aria-hidden="true" />
                <span className="outcome-label">
                  {isWinner && <span className="whistle" aria-label="winning outcome">◉ </span>}
                  {label}
                </span>
                <span className="outcome-count mono">{entries.toString()}</span>
              </button>
            );
          })}
        </div>

        <div className="ticket-actions">
          {effectiveStatus === 0 && (
            <button className="btn btn-amber" disabled={picked === null || busy} onClick={join}>
              {busy ? "Confirming…" : picked === null ? "Pick an outcome" : `Stake ${formatUSDC(pool.entryAmount)} USDC`}
            </button>
          )}
          {effectiveStatus === 1 && <span className="waiting mono">Match underway. The referee settles at full time.</span>}
          {settled && (
            <button className="btn btn-chalk" disabled={busy} onClick={claim}>
              {busy ? "Confirming…" : "Claim winnings"}
            </button>
          )}
          {voided && <span className="waiting mono">Nobody picked the result. Stakes are refundable in full.</span>}
        </div>
      </div>
    </article>
  );
}
