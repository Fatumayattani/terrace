// Compiles contracts/ with solc and writes ABI + bytecode to contracts/out/.
// Run: node contracts/compile.mjs
import solc from "solc";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
const files = ["TerracePool.sol", "MockUSDC.sol"];

const sources = {};
for (const f of files) sources[f] = { content: readFileSync(join(root, f), "utf8") };

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((e) => e.severity === "error");
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}
for (const w of (output.errors || []).filter((e) => e.severity === "warning")) {
  console.warn(w.formattedMessage);
}

mkdirSync(join(root, "out"), { recursive: true });
for (const file of Object.keys(output.contracts)) {
  for (const [name, c] of Object.entries(output.contracts[file])) {
    if (name === "IERC20") continue;
    writeFileSync(
      join(root, "out", `${name}.json`),
      JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2)
    );
    console.log(`compiled ${name} -> contracts/out/${name}.json`);
  }
}
