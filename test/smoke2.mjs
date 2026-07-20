import { spawn } from "node:child_process";

const proc = spawn("node", ["src/index.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PAYWAY_MERCHANT_ID: "test_mid", PAYWAY_API_KEY: "test_key" },
});

let buf = "";
proc.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id === 1) {
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "payway_exchange_rate", arguments: {} },
      });
    } else if (msg.id === 2) {
      console.log("CALL_RESULT:", JSON.stringify(msg.result));
      proc.kill();
      process.exit(0);
    }
  }
});
proc.stderr.on("data", (d) => console.error("STDERR:", d.toString()));
function send(obj) {
  proc.stdin.write(JSON.stringify(obj) + "\n");
}
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } },
});
setTimeout(() => {
  console.error("TIMEOUT");
  proc.kill();
  process.exit(1);
}, 8000);
