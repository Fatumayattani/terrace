import type { FeedEvent } from "../chain";

const KIND_META: Record<FeedEvent["kind"], { icon: string; label: string }> = {
  Settled: { icon: "◉", label: "Full time" },
  Voided: { icon: "▣", label: "Voided" },
  Claimed: { icon: "▲", label: "Claimed" },
  Joined: { icon: "＋", label: "Entry" },
  PoolCreated: { icon: "✦", label: "New pool" },
};

export function RefereeFeed({
  feed,
  explorer,
  demo,
}: {
  feed: FeedEvent[];
  explorer: string;
  demo: boolean;
}) {
  return (
    <aside className="feed" aria-label="Referee feed">
      <div className="feed-head">
        <h2>Referee feed</h2>
        <span className="feed-live mono">
          <span className="feed-dot" aria-hidden="true" /> on-chain
        </span>
      </div>
      <p className="feed-sub">
        Every call the agent makes lands here, straight from contract events.
      </p>
      <ol className="feed-list">
        {feed.length === 0 && <li className="feed-empty">Quiet before kickoff.</li>}
        {feed.slice(0, 12).map((e, i) => (
          <li key={i} className={`feed-item feed-${e.kind.toLowerCase()}`}>
            <span className="feed-icon" aria-hidden="true">
              {KIND_META[e.kind].icon}
            </span>
            <div className="feed-text">
              <span className="feed-kind">
                {KIND_META[e.kind].label} · pool #{e.poolId.toString()}
              </span>
              <span className="feed-detail">{e.detail}</span>
              {!demo && e.txHash !== "0xdemo" && (
                <a
                  className="feed-tx mono"
                  href={`${explorer}/tx/${e.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {e.txHash.slice(0, 10)}…{e.txHash.slice(-6)}
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
