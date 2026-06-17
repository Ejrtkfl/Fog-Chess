const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "stockfish");
const outputFile = path.join(outputDir, "stockfish.js");

const candidates = [
  path.join(projectRoot, "node_modules", "stockfish", "src", "stockfish.js"),
  path.join(projectRoot, "node_modules", "stockfish", "stockfish.js"),
  path.join(projectRoot, "node_modules", "stockfish", "src", "stockfish-nnue-16.js"),
  path.join(projectRoot, "node_modules", "stockfish", "stockfish-nnue-16.js"),
];

fs.mkdirSync(outputDir, { recursive: true });

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    fs.copyFileSync(candidate, outputFile);
    console.log(`[stockfish] copied: ${candidate} -> ${outputFile}`);
    process.exit(0);
  }
}

console.warn("[stockfish] stockfish.js file was not found in node_modules.");
console.warn("[stockfish] The game will still run using the built-in fallback AI.");
