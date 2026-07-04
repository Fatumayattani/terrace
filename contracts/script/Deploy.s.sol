// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {USDT} from "../src/USDT.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        USDT usdt = new USDT();
        vm.stopBroadcast();

        console.log("USDT deployed to:", address(usdt));
        console.log("Deployer balance: 1,000,000 USDT");
        console.log("Faucet: 1,000 USDT per call, open to anyone");
    }
}
