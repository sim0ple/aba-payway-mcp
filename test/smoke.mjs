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
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        console.log("INIT_OK:", JSON.stringify(msg.result?.serverInfo));
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      } else if (msg.id === 2) {
        const names = msg.result.tools.map((t) => t.name);
        console.log("TOOL_COUNT:", names.length);
        console.log("TOOLS:", names.join(", "));
        proc.kill();
        process.exit(0);
      }
    } catch (e) {
      console.error("parse error", e, line);
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
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.1" },
  },
});

setTimeout(() => {
  console.error("TIMEOUT");
  proc.kill();
  process.exit(1);
}, 5000);
