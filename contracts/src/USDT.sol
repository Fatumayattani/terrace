// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title USDT on Arbitrum Sepolia (Terrace deployment, mainnet-identical interface)
/// @notice Standard ERC20 with 6 decimals matching mainnet USDt, plus an open
///         faucet so judges and testers can fund themselves. Self-contained,
///         no external dependencies.
contract USDT {
    string public constant name = "Tether USD";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Amount dispensed per faucet call: 1,000 USDT
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 6;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        // Seed the deployer with 1,000,000 USDT for funding test wallets
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    /// @notice Anyone can call this to receive 1,000 USDT for testing
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Faucet to an arbitrary address, useful for funding app-generated wallets
    function faucetTo(address to) external {
        _mint(to, FAUCET_AMOUNT);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "USDT: insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "USDT: transfer to zero address");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "USDT: insufficient balance");
        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "USDT: mint to zero address");
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }
}
