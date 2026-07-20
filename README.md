# aba-payway-mcp

**Open source. Unofficial. Community-built.** This is not an ABA Bank or
PayWay product, and it isn't endorsed, reviewed, or supported by them —
it's an independent MCP wrapper around their publicly documented API. Use
it at your own risk, review the code before pointing it at production
credentials, and see [LICENSE](LICENSE) for the full disclaimer.

An MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server
that wraps ABA Bank's **PayWay** API (https://developer.payway.com.kh) so
any MCP-compatible AI tool — Claude Code, Claude Desktop, Cursor, Windsurf,
Cline, VS Code/Copilot, Gemini CLI, or any other MCP client — can create
checkouts, generate KHQR codes, check/list transactions, issue refunds,
create payment links, and pull exchange rates, directly from a chat or
agent session.

Released under the MIT license — free to use, fork, modify, and
redistribute. Built from the public PayWay developer docs (Ecommerce
Checkout, ABA QR API, Payment Link, KHQR Guideline sections). PRs and
issues welcome; see [Contributing](#contributing).

## Tools

| Tool | PayWay endpoint | Notes |
|---|---|---|
| `payway_purchase` | Purchase | hosted checkout / popup / KHQR / cards / wallets |
| `payway_generate_qr` | ABA QR API — generate-qr | KHQR / WeChat / Alipay, no hosted page |
| `payway_check_transaction` | check-transaction-2 | status, ≤7 days old |
| `payway_get_transaction_details` | transaction-detail | any age, full history, 10 req/min |
| `payway_get_transaction_list` | transaction-list-2 | filtered list, ≤3 day range, 50 req/min |
| `payway_get_transactions_by_merchant_ref` | get-transactions-by-mc-ref | KHQR tag 62.01 lookup |
| `payway_close_transaction` | close-transaction | cancel a pending tx |
| `payway_refund` | online-transaction/refund | full/partial, ≤30 days, needs RSA key |
| `payway_exchange_rate` | exchange-rate | ABA buy/sell rates |
| `payway_create_payment_link` | payment-link/create | needs RSA key |
| `payway_get_payment_link_details` | payment-link/detail | needs RSA key |

Every hash is generated in the exact field order PayWay's docs specify per
endpoint (`req_time`/`request_time` + `merchant_id` + ... + your
`api_key`, HMAC-SHA512, base64) — this matters because a wrong field order
produces a valid-looking hash that PayWay silently rejects. `merchant_auth`
fields (Refund, Payment Link) are RSA-PKCS1 encrypted in 117-byte chunks,
matching PayWay's own PHP sample code exactly (`openssl_public_encrypt`
default padding, not OAEP).

## Requirements

- Node.js 18+
- A PayWay sandbox or production merchant profile (sandbox sign-up:
  https://sandbox.payway.com.kh/register-sandbox/, production: contact
  `paywaysales@ababank.com`)
- Your **server's egress IP whitelisted with PayWay** — this server calls
  the API directly (not from a browser), so PayWay needs to allow that IP,
  not just a frontend domain.

## Install

Clone and run locally:

```bash
git clone https://github.com/sim0ple/aba-payway-mcp.git
cd aba-payway-mcp
npm install
```

Or, once published to npm, run it with `npx` without cloning anything (see
per-client examples below) — `npx -y aba-payway-mcp`.

## Configuration

Set as environment variables in your MCP client's config (never hardcode
secrets in code or commit them):

| Variable | Required | Notes |
|---|---|---|
| `PAYWAY_MERCHANT_ID` | yes | Your merchant key from ABA Bank |
| `PAYWAY_API_KEY` | yes | HMAC secret ("public_key" in PayWay's docs — used for HMAC-SHA512 hashing) |
| `PAYWAY_ENV` | no | `sandbox` (default) or `production` |
| `PAYWAY_RSA_PUBLIC_KEY` | only for refund / payment-link tools | RSA public key PEM ABA Bank issued for `merchant_auth` encryption. Literal `\n` in a one-line env value is fine — it's unescaped automatically. |

---

## Adding it to your AI tool

Every client below ultimately runs the same command:

```
node /absolute/path/to/aba-payway-mcp/src/index.js
```

(or `npx -y aba-payway-mcp` once it's published to npm). Only the
configuration mechanism differs per tool.

### Claude Code (CLI)

Claude Code has a built-in `claude mcp add` command. Everything after `--`
is the command it runs to start the server; flags before `--` configure
how Claude Code registers it.

```bash
claude mcp add payway \
  --env PAYWAY_MERCHANT_ID=your_merchant_id \
  --env PAYWAY_API_KEY=your_api_key \
  --env PAYWAY_ENV=sandbox \
  -- node /absolute/path/to/aba-payway-mcp/src/index.js
```

Add `--env PAYWAY_RSA_PUBLIC_KEY="$(cat your_key.pem)"` if you need the
refund / payment-link tools.

Once published to npm, you can skip the clone entirely:

```bash
claude mcp add payway \
  --env PAYWAY_MERCHANT_ID=your_merchant_id \
  --env PAYWAY_API_KEY=your_api_key \
  --env PAYWAY_ENV=sandbox \
  -- npx -y aba-payway-mcp
```

Useful follow-ups:

```bash
claude mcp list                 # check connection status
claude mcp get payway           # see the exact command/env Claude Code stored
claude mcp remove payway        # remove it
```

**Scope** — by default `claude mcp add` registers the server at `local`
scope (just you, just this project). Pass `--scope user` to make it
available in every project on your machine, or `--scope project` to write
it to `.mcp.json` at the project root so teammates get it too when they
clone the repo (they'll be prompted to approve it — don't commit real
secrets, reference them as `${PAYWAY_API_KEY}` and set that env var per
machine, or use a `.env` your team doesn't commit):

```bash
claude mcp add --scope project payway \
  --env PAYWAY_MERCHANT_ID='${PAYWAY_MERCHANT_ID}' \
  --env PAYWAY_API_KEY='${PAYWAY_API_KEY}' \
  -- npx -y aba-payway-mcp
```

If you'd rather write the config by hand, this is the equivalent
`.mcp.json` entry (project scope) or `~/.claude.json` entry (user scope):

```json
{
  "mcpServers": {
    "payway": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

### Claude Desktop

Settings → Developer → Edit Config opens `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox",
        "PAYWAY_RSA_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
      }
    }
  }
}
```

Restart Claude Desktop to pick up the change.

### Cursor

`.cursor/mcp.json` in your project (project-scoped) or the global one via
Cursor Settings → MCP (available everywhere):

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json` directly (macOS/Linux) or
`%USERPROFILE%\.codeium\windsurf\mcp_config.json` (Windows) — or open it
via the hammer icon in Cascade → Configure:

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

### Cline (VS Code extension)

Open the Cline sidebar → MCP Servers icon → "Edit MCP Settings" (or
`cline_mcp_settings.json` directly), same `mcpServers` shape:

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

VS Code can add an MCP server straight from the command line:

```bash
code --add-mcp '{"name":"payway","command":"npx","args":["-y","aba-payway-mcp"],"env":{"PAYWAY_MERCHANT_ID":"your_merchant_id","PAYWAY_API_KEY":"your_api_key","PAYWAY_ENV":"sandbox"}}'
```

Or via the Command Palette → `MCP: Add Server`, or by hand in
`.vscode/mcp.json` (workspace) / user `mcp.json` (global):

```json
{
  "servers": {
    "payway": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

### Gemini CLI

Gemini CLI also has a native `add` subcommand:

```bash
gemini mcp add payway \
  -e PAYWAY_MERCHANT_ID=your_merchant_id \
  -e PAYWAY_API_KEY=your_api_key \
  -e PAYWAY_ENV=sandbox \
  -- npx -y aba-payway-mcp
```

`-s user` (default `project`) makes it available across all your projects
instead of just the current one:

```bash
gemini mcp add -s user payway -e PAYWAY_MERCHANT_ID=your_merchant_id -e PAYWAY_API_KEY=your_api_key -- npx -y aba-payway-mcp
```

This writes to `~/.gemini/settings.json` (user) or `.gemini/settings.json`
(project).

### Any other MCP client

If your tool isn't listed above, it almost certainly still reads the same
shape — an `mcpServers` (or `servers`) object with `command`, `args`, and
`env`:

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "aba-payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

Point `command` at `node` with the absolute path to `src/index.js` instead
of `npx` if you're running from a local clone rather than a published npm
package. Check your client's docs for the exact config file path and key
name (`mcpServers` vs `servers` is the main variant).

---

## Publishing to npm (so `npx aba-payway-mcp` works for others)

```bash
npm login
npm publish --access public
```

Bump `version` in `package.json` and re-publish for updates. Nothing else
needs to change — the `bin` field already points at `src/index.js`, which
has a `#!/usr/bin/env node` shebang.

## Local smoke test (no live PayWay credentials needed)

```bash
npm test
```

This spawns the server over stdio, does the MCP `initialize` handshake,
lists all 11 tools, and calls `payway_exchange_rate` with dummy credentials
to confirm the hashing/config code path runs (it'll get a network/auth
error against real PayWay, which is expected without real creds — the
point is confirming nothing throws before that).

## Notes / gotchas carried over from the PayWay docs

- `payway_purchase` with no `payment_option` and `hosted_view` returns full
  checkout HTML (a redirect page) rather than JSON — that's normal PayWay
  behavior, not a bug here.
- `payway_check_transaction` only works ≤7 days old; use
  `payway_get_transaction_details` for older transactions.
- `payway_get_transaction_list` date range is capped at 3 days by PayWay.
- Refunds only work on `COMPLETED`/`APPROVED` transactions within 30 days.
- Amount/currency minimums (100 KHR / 0.01 USD, etc.) are enforced by
  PayWay itself, not duplicated here — check `status.code` in the response
  if something's rejected.

## Project layout

```
aba-payway-mcp/
├── package.json
├── src/
│   ├── index.js    # MCP server + all tool definitions
│   └── payway.js   # HMAC hashing / RSA encryption / HTTP client
├── test/           # stdio smoke tests, no live credentials required
├── .env.example
└── .github/workflows/ci.yml
```

## Contributing

This is an open-source, community-maintained project — issues and PRs
welcome, especially for the remaining PayWay sections not yet covered
(Credentials on File / tokenized payments, Pre-auth capture flow,
multi-party Payout, Shopify/WooCommerce/Prestashop plugin helpers).

## Disclaimer

`aba-payway-mcp` is an **unofficial**, independently developed
integration. It is not created by, affiliated with, or endorsed by ABA
Bank or PayWay. "PayWay" and "ABA" are trademarks of their respective
owners. Provided as-is, with no warranty — see [LICENSE](LICENSE).

## License

MIT — free and open source. See [LICENSE](LICENSE).
