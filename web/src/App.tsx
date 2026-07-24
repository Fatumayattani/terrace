import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address, WalletClient } from "viem";
import { CONFIG } from "./config";
import { connectWallet, fetchFeed, fetchPools, type FeedEvent, type PoolView } from "./chain";
import { DEMO_FEED, DEMO_POOLS } from "./demo";
import { TicketCard } from "./components/TicketCard";
import { RefereeFeed } from "./components/RefereeFeed";
import { CreatePoolModal } from "./components/CreatePoolModal";

export default function App() {
  const [pools, setPools] = useState<PoolView[]>(CONFIG.demoMode ? DEMO_POOLS : []);
  const [feed, setFeed] = useState<FeedEvent[]>(CONFIG.demoMode ? DEMO_FEED : []);
  const [account, setAccount] = useState<Address | null>(null);
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (CONFIG.demoMode) return;
    try {
      const [p, f] = await Promise.all([fetchPools(), fetchFeed()]);
      setPools(p);
      setFeed(f);
    } catch (err) {
      setNotice(`Chain read failed: ${(err as Error).message.split("\n")[0]}`);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const onConnect = async () => {
    const res = await connectWallet();
    if (!res) {
      setNotice("No EVM wallet found. Install MetaMask or Rabby, then reload.");
      return;
    }
    setAccount(res.address);
    setWallet(res.wallet);
  };

  const nextLock = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const open = pools.filter((p) => p.status === 0 && p.lockTime > now);
    if (!open.length) return null;
    return open.reduce((a, b) => (a.lockTime < b.lockTime ? a : b));
  }, [pools]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark" aria-label="Terrace">
          TERRACE
        </div>
        <div className="topbar-right">
          <span className="net-pill">{CONFIG.demoMode ? "demo" : CONFIG.network.name}</span>
          {account ? (
            <span className="wallet mono">{account.slice(0, 6)}…{account.slice(-4)}</span>
          ) : (
            <button className="btn btn-ghost" onClick={onConnect}>
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <Scoreboard nextLock={nextLock} />

      <section className="intro">
        <h1>
          The stand settles itself.
        </h1>
        <p>
          Stake USDC on a World Cup outcome with your crew. At full time an autonomous referee
          buys the verified result for a few cents over x402 and settles the pool on Injective.
          It can call the score. It can never touch the money.
        </p>
        <div className="intro-actions">
          <button className="btn btn-amber" onClick={() => setCreating(true)}>
            Open a pool
          </button>
          <a
            className="btn btn-ghost"
            href="https://github.com/Fatumayattani/terrace"
            target="_blank"
            rel="noreferrer"
          >
            Read the code
          </a>
        </div>
      </section>

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="notice-x" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <main className="layout">
        <section className="pools" aria-label="Pools">
          {pools.length === 0 && (
            <div className="empty">
              No pools yet. Open the first one and pick your final.
            </div>
          )}
          {pools.map((p) => (
            <TicketCard
              key={p.id.toString()}
              pool={p}
              account={account}
              wallet={wallet}
              onChanged={refresh}
              onNotice={setNotice}
              onNeedWallet={onConnect}
            />
          ))}
        </section>
        <RefereeFeed feed={feed} explorer={CONFIG.network.explorer} demo={CONFIG.demoMode} />
      </main>

      <footer className="footer">
        <span>Built on Injective · x402 · CCTP USDC · MCP · Agent Skills</span>
        <span className="mono">World Cup 2026</span>
      </footer>

      {creating && (
        <CreatePoolModal
          account={account}
          wallet={wallet}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
          onNotice={setNotice}
          onNeedWallet={onConnect}
        />
      )}
    </div>
  );
}

function Scoreboard({ nextLock }: { nextLock: PoolView | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  let text = "FULL TIME ACROSS ALL POOLS · OPEN A NEW ONE";
  if (nextLock) {
    const secs = Number(nextLock.lockTime) - Math.floor(Date.now() / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    text = `NEXT LOCK ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} · ${nextLock.title.toUpperCase()}`;
  }

  return (
    <div className="scoreboard" role="timer" aria-live="off">
      <span className="scoreboard-dot" aria-hidden="true" />
      <span className="scoreboard-text mono">{text}</span>
    </div>
  );
}
