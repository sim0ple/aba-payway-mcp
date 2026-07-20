# payway-mcp

**Open source. Unofficial. Community-built.** This is not an ABA Bank or
PayWay product, and it isn't endorsed, reviewed, or supported by them —
it's an independent MCP wrapper around their publicly documented API. Use
it at your own risk, review the code before pointing it at production
credentials, and see [LICENSE](LICENSE) for the full disclaimer.

An MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server
that wraps ABA Bank's **PayWay** API (https://developer.payway.com.kh) so
any MCP-compatible AI tool — Claude Code, Claude Desktop, Cursor, Cline,
Windsurf, etc. — can create checkouts, generate KHQR codes, check/list
transactions, issue refunds, create payment links, and pull exchange rates,
directly from a chat or agent session.

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
git clone https://github.com/YOUR_GITHUB_USERNAME/payway-mcp.git
cd payway-mcp
npm install
```

Or, once published to npm, run it with `npx` without cloning anything (see
per-client examples below) — `npx -y payway-mcp`.

## Configuration

Set as environment variables in your MCP client's config (never hardcode
secrets in code or commit them):

| Variable | Required | Notes |
|---|---|---|
| `PAYWAY_MERCHANT_ID` | yes | Your merchant key from ABA Bank |
| `PAYWAY_API_KEY` | yes | HMAC secret ("public_key" in PayWay's docs — used for HMAC-SHA512 hashing) |
| `PAYWAY_ENV` | no | `sandbox` (default) or `production` |
| `PAYWAY_RSA_PUBLIC_KEY` | only for refund / payment-link tools | RSA public key PEM ABA Bank issued for `merchant_auth` encryption. Literal `\n` in a one-line env value is fine — it's unescaped automatically. |

## Adding it to your AI tool

### Claude Code (CLI)

From a local clone:

```bash
claude mcp add payway \
  -e PAYWAY_MERCHANT_ID=your_merchant_id \
  -e PAYWAY_API_KEY=your_api_key \
  -e PAYWAY_ENV=sandbox \
  -- node /absolute/path/to/payway-mcp/src/index.js
```

Or, once published to npm:

```bash
claude mcp add payway \
  -e PAYWAY_MERCHANT_ID=your_merchant_id \
  -e PAYWAY_API_KEY=your_api_key \
  -e PAYWAY_ENV=sandbox \
  -- npx -y payway-mcp
```

Use `claude mcp add --scope project` instead of the default (local) scope
if you want it committed to a repo's `.mcp.json` for teammates to share
(don't commit real secrets — use `${PAYWAY_API_KEY}` env references or a
per-user `.env`).

### Claude Desktop

Edit your `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "payway-mcp"],
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

### Cursor

`.cursor/mcp.json` in your project (or the global one in Cursor settings):

```json
{
  "mcpServers": {
    "payway": {
      "command": "npx",
      "args": ["-y", "payway-mcp"],
      "env": {
        "PAYWAY_MERCHANT_ID": "your_merchant_id",
        "PAYWAY_API_KEY": "your_api_key",
        "PAYWAY_ENV": "sandbox"
      }
    }
  }
}
```

### Cline / Windsurf / other MCP-JSON clients

Same shape as above — these tools all read an `mcpServers` object with
`command`/`args`/`env`. Point `command` at `npx` (`args: ["-y",
"payway-mcp"]`) or directly at `node` with the absolute path to
`src/index.js` from a local clone, whichever your client's docs prefer.

## Publishing to npm (so `npx payway-mcp` works for others)

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
payway-mcp/
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

`payway-mcp` is an **unofficial**, independently developed integration. It
is not created by, affiliated with, or endorsed by ABA Bank or PayWay.
"PayWay" and "ABA" are trademarks of their respective owners. Provided
as-is, with no warranty — see [LICENSE](LICENSE).

## License

MIT — free and open source. See [LICENSE](LICENSE).
