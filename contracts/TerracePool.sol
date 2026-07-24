// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TerracePool
/// @notice World Cup prediction pools with autonomous, bounded agent settlement.
///
/// Fans stake USDC on a match outcome. When the match ends, the Terrace
/// settlement agent pays an x402-gated result oracle for the verified final
/// score, then calls `settle` here. Winners split the pot pro rata.
///
/// Bounded authority: the agent can ONLY declare a winning outcome, and only
/// after the pool locks. It can never move funds. Payouts flow exclusively
/// through `claim` (winner-initiated) and `refund` (staker-initiated escape
/// hatch if the agent never settles). The agent's maximum damage is a wrong
/// outcome, and even that is capped by the refund path never being burned:
/// if nobody picked the declared outcome, every staker gets their money back.
contract TerracePool {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Status {
        Open,     // accepting entries
        Locked,   // match underway, no entries, awaiting settlement
        Settled,  // agent declared a winning outcome
        Voided    // settled with an outcome nobody picked -> everyone refunds
    }

    struct Pool {
        string matchId;        // oracle match key, e.g. "wc2026-final"
        string title;          // human label, e.g. "Final: FRA v BRA"
        string[] outcomes;     // e.g. ["France win", "Draw", "Brazil win"]
        uint256 entryAmount;   // stake per entry, in token base units
        uint64 lockTime;       // unix seconds; entries close, settlement opens
        uint8 winningOutcome;  // valid only when status == Settled
        Status status;
        uint256 pot;           // total staked
        uint256 winnerCount;   // entries on the winning outcome
        uint256 payoutPerWinner;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    IERC20 public immutable stakeToken;   // USDC (6 decimals) on Injective EVM
    address public owner;                 // can rotate the agent key, nothing else
    address public agent;                 // the settlement agent

    /// If the agent has not settled this long after lock, stakers may refund.
    uint64 public constant SETTLEMENT_GRACE = 48 hours;

    Pool[] private pools;

    // poolId => outcomeIndex => entry count
    mapping(uint256 => mapping(uint8 => uint256)) public entriesPerOutcome;
    // poolId => staker => outcomeIndex => entry count
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public entriesOf;
    // poolId => staker => amount already refunded/claimed guard
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event PoolCreated(uint256 indexed poolId, string matchId, string title, uint256 entryAmount, uint64 lockTime);
    event Joined(uint256 indexed poolId, address indexed staker, uint8 outcome, uint256 entries);
    event Settled(uint256 indexed poolId, uint8 winningOutcome, uint256 pot, uint256 winnerCount);
    event Voided(uint256 indexed poolId, uint8 declaredOutcome);
    event Claimed(uint256 indexed poolId, address indexed staker, uint256 amount);
    event Refunded(uint256 indexed poolId, address indexed staker, uint256 amount);
    event AgentRotated(address indexed previousAgent, address indexed newAgent);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotAgent();
    error PoolNotOpen();
    error PoolNotLocked();
    error PoolNotSettled();
    error TooEarly();
    error BadOutcome();
    error BadParams();
    error NothingToClaim();
    error TransferFailed();

    constructor(address _stakeToken, address _agent) {
        if (_stakeToken == address(0) || _agent == address(0)) revert BadParams();
        stakeToken = IERC20(_stakeToken);
        owner = msg.sender;
        agent = _agent;
    }

    // ---------------------------------------------------------------------
    // Pool lifecycle
    // ---------------------------------------------------------------------

    /// @notice Anyone can open a pool. Terrace is permissionless.
    function createPool(
        string calldata matchId,
        string calldata title,
        string[] calldata outcomes,
        uint256 entryAmount,
        uint64 lockTime
    ) external returns (uint256 poolId) {
        if (outcomes.length < 2 || outcomes.length > 8) revert BadParams();
        if (entryAmount == 0) revert BadParams();
        if (lockTime <= block.timestamp) revert BadParams();

        Pool storage p = pools.push();
        p.matchId = matchId;
        p.title = title;
        for (uint256 i = 0; i < outcomes.length; i++) p.outcomes.push(outcomes[i]);
        p.entryAmount = entryAmount;
        p.lockTime = lockTime;
        p.status = Status.Open;

        poolId = pools.length - 1;
        emit PoolCreated(poolId, matchId, title, entryAmount, lockTime);
    }

    /// @notice Stake `entries * entryAmount` on one outcome. Requires prior approve.
    function join(uint256 poolId, uint8 outcome, uint256 entries) external {
        Pool storage p = _pool(poolId);
        if (p.status != Status.Open || block.timestamp >= p.lockTime) revert PoolNotOpen();
        if (outcome >= p.outcomes.length) revert BadOutcome();
        if (entries == 0) revert BadParams();

        uint256 amount = p.entryAmount * entries;
        p.pot += amount;
        entriesPerOutcome[poolId][outcome] += entries;
        entriesOf[poolId][msg.sender][outcome] += entries;

        if (!stakeToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Joined(poolId, msg.sender, outcome, entries);
    }

    // ---------------------------------------------------------------------
    // Agent settlement (the entire authority surface of the agent)
    // ---------------------------------------------------------------------

    /// @notice Declare the winning outcome. Agent only, post-lock only.
    /// The agent moves no funds here; it fixes the payout math and steps aside.
    function settle(uint256 poolId, uint8 winningOutcome) external {
        if (msg.sender != agent) revert NotAgent();
        Pool storage p = _pool(poolId);
        if (p.status != Status.Open && p.status != Status.Locked) revert PoolNotLocked();
        if (block.timestamp < p.lockTime) revert TooEarly();
        if (winningOutcome >= p.outcomes.length) revert BadOutcome();

        uint256 winners = entriesPerOutcome[poolId][winningOutcome];
        p.winningOutcome = winningOutcome;

        if (winners == 0) {
            // Nobody picked it. Nothing is stranded: the pool voids and every
            // staker refunds their full stake.
            p.status = Status.Voided;
            emit Voided(poolId, winningOutcome);
            return;
        }

        p.status = Status.Settled;
        p.winnerCount = winners;
        p.payoutPerWinner = p.pot / winners; // dust stays in contract, negligible at 6 decimals
        emit Settled(poolId, winningOutcome, p.pot, winners);
    }

    // ---------------------------------------------------------------------
    // Staker exits
    // ---------------------------------------------------------------------

    /// @notice Winners pull their share after settlement.
    function claim(uint256 poolId) external {
        Pool storage p = _pool(poolId);
        if (p.status != Status.Settled) revert PoolNotSettled();
        if (claimed[poolId][msg.sender]) revert NothingToClaim();

        uint256 winningEntries = entriesOf[poolId][msg.sender][p.winningOutcome];
        if (winningEntries == 0) revert NothingToClaim();

        claimed[poolId][msg.sender] = true;
        uint256 amount = p.payoutPerWinner * winningEntries;

        if (!stakeToken.transfer(msg.sender, amount)) revert TransferFailed();
        emit Claimed(poolId, msg.sender, amount);
    }

    /// @notice Escape hatch. Full refund of every entry if the pool voided, or
    /// if the agent went silent for SETTLEMENT_GRACE after lock.
    function refund(uint256 poolId) external {
        Pool storage p = _pool(poolId);
        bool voided = p.status == Status.Voided;
        bool abandoned = (p.status == Status.Open || p.status == Status.Locked)
            && block.timestamp > uint256(p.lockTime) + SETTLEMENT_GRACE;
        if (!voided && !abandoned) revert TooEarly();
        if (claimed[poolId][msg.sender]) revert NothingToClaim();

        uint256 totalEntries;
        for (uint8 i = 0; i < p.outcomes.length; i++) {
            totalEntries += entriesOf[poolId][msg.sender][i];
        }
        if (totalEntries == 0) revert NothingToClaim();

        claimed[poolId][msg.sender] = true;
        uint256 amount = p.entryAmount * totalEntries;

        if (!stakeToken.transfer(msg.sender, amount)) revert TransferFailed();
        emit Refunded(poolId, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Admin (deliberately tiny)
    // ---------------------------------------------------------------------

    function rotateAgent(address newAgent) external {
        if (msg.sender != owner) revert NotOwner();
        if (newAgent == address(0)) revert BadParams();
        emit AgentRotated(agent, newAgent);
        agent = newAgent;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function poolCount() external view returns (uint256) {
        return pools.length;
    }

    function getPool(uint256 poolId)
        external
        view
        returns (
            string memory matchId,
            string memory title,
            string[] memory outcomes,
            uint256 entryAmount,
            uint64 lockTime,
            uint8 winningOutcome,
            Status status,
            uint256 pot,
            uint256[] memory outcomeEntries
        )
    {
        Pool storage p = _pool(poolId);
        uint256[] memory oe = new uint256[](p.outcomes.length);
        for (uint8 i = 0; i < p.outcomes.length; i++) {
            oe[i] = entriesPerOutcome[poolId][i];
        }
        return (p.matchId, p.title, p.outcomes, p.entryAmount, p.lockTime, p.winningOutcome, p.status, p.pot, oe);
    }

    function _pool(uint256 poolId) private view returns (Pool storage) {
        if (poolId >= pools.length) revert BadParams();
        return pools[poolId];
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
