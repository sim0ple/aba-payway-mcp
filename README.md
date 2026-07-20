aba-payway-mcpOpen source. Unofficial. Community-built. This is not an ABA Bank orPayWay product, and it isn't endorsed, reviewed, or supported by them —it's an independent MCP wrapper around their publicly documented API. Useit at your own risk, review the code before pointing it at productioncredentials, and see LICENSE for the full disclaimer.An MCP (Model Context Protocol) serverthat wraps ABA Bank's PayWay API (https://developer.payway.com.kh) soany MCP-compatible AI tool — Claude Code, Claude Desktop, Cursor, Windsurf,Cline, VS Code/Copilot, Gemini CLI, or any other MCP client — can createcheckouts, generate KHQR codes, check/list transactions, issue refunds,create payment links, and pull exchange rates, directly from a chat oragent session.Released under the MIT license — free to use, fork, modify, andredistribute. Built from the public PayWay developer docs (EcommerceCheckout, ABA QR API, Payment Link, KHQR Guideline sections). PRs andissues welcome; see Contributing.ToolsToolPayWay endpointNotespayway_purchasePurchasehosted checkout / popup / KHQR / cards / walletspayway_generate_qrABA QR API — generate-qrKHQR / WeChat / Alipay, no hosted pagepayway_check_transactioncheck-transaction-2status, ≤7 days oldpayway_get_transaction_detailstransaction-detailany age, full history, 10 req/minpayway_get_transaction_listtransaction-list-2filtered list, ≤3 day range, 50 req/minpayway_get_transactions_by_merchant_refget-transactions-by-mc-refKHQR tag 62.01 lookuppayway_close_transactionclose-transactioncancel a pending txpayway_refundonline-transaction/refundfull/partial, ≤30 days, needs RSA keypayway_exchange_rateexchange-rateABA buy/sell ratespayway_create_payment_linkpayment-link/createneeds RSA keypayway_get_payment_link_detailspayment-link/detailneeds RSA keyEvery hash is generated in the exact field order PayWay's docs specify perendpoint (req_time/request_time + merchant_id + ... + yourapi_key, HMAC-SHA512, base64) — this matters because a wrong field orderproduces a valid-looking hash that PayWay silently rejects. merchant_authfields (Refund, Payment Link) are RSA-PKCS1 encrypted in 117-byte chunks,matching PayWay's own PHP sample code exactly (openssl_public_encryptdefault padding, not OAEP).RequirementsNode.js 18+A PayWay sandbox or production merchant profile (sandbox sign-up:https://sandbox.payway.com.kh/register-sandbox/, production: contactpaywaysales@ababank.com)Your server's egress IP whitelisted with PayWay — this server callsthe API directly (not from a browser), so PayWay needs to allow that IP,not just a frontend domain.InstallClone and run locally:git clone https://github.com/sim0ple/aba-payway-mcp.git
cd aba-payway-mcp
npm install
Or run it directly using npx (if using the published package):npx -y aba-payway-mcp
ConfigurationSet as environment variables in your MCP client's config (never hardcodesecrets in code or commit them):VariableRequiredNotesPAYWAY_MERCHANT_IDyesYour merchant key from ABA BankPAYWAY_API_KEYyesHMAC secret ("public_key" in PayWay's docs — used for HMAC-SHA512 hashing)PAYWAY_ENVnosandbox (default) or productionPAYWAY_RSA_PUBLIC_KEYonly for refund / payment-link toolsRSA public key PEM ABA Bank issued for merchant_auth encryption. Literal \n in a one-line env value is fine — it's unescaped automatically.Adding it to your AI toolEvery client below ultimately runs the same command:node /absolute/path/to/aba-payway-mcp/src/index.js
(or npx -y aba-payway-mcp if utilizing the registry package). Only theconfiguration mechanism differs per tool.Claude Code (CLI)Claude Code has a built-in claude mcp add command. Everything after --is the command it runs to start the server; flags before -- configurehow Claude Code registers it.claude mcp add payway \
  --env PAYWAY_MERCHANT_ID=your_merchant_id \
  --env PAYWAY_API_KEY=your_api_key \
  --env PAYWAY_ENV=sandbox \
  -- node /absolute/path/to/aba-payway-mcp/src/index.js
Add --env PAYWAY_RSA_PUBLIC_KEY="$(cat your_key.pem)" if you need therefund / payment-link tools.If you are using the npm package, you can register it without cloning locally:claude mcp add payway \
  --env PAYWAY_MERCHANT_ID=your_merchant_id \
  --env PAYWAY_API_KEY=your_api_key \
  --env PAYWAY_ENV=sandbox \
  -- npx -y aba-payway-mcp
Useful follow-ups:claude mcp list                 # check connection status
claude mcp get payway           # see the exact command/env Claude Code stored
claude mcp remove payway        # remove it
Scope — by default claude mcp add registers the server at localscope (just you, just this project). Pass --scope user to make itavailable in every project on your machine, or --scope project to writeit to .mcp.json at the project root so teammates get it too when theyclone the repo (they'll be prompted to approve it — don't commit realsecrets, reference them as ${PAYWAY_API_KEY} and set that env var permachine, or use a .env your team doesn't commit):claude mcp add --scope project payway \
  --env PAYWAY_MERCHANT_ID='${PAYWAY_MERCHANT_ID}' \
  --env PAYWAY_API_KEY='${PAYWAY_API_KEY}' \
  -- npx -y aba-payway-mcp
If you'd rather write the config by hand, this is the equivalent.mcp.json entry (project scope) or ~/.claude.json entry (user scope):{
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
Claude DesktopSettings → Developer → Edit Config opens claude_desktop_config.json:{
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
Restart Claude Desktop to pick up the change.Cursor.cursor/mcp.json in your project (project-scoped) or the global one viaCursor Settings → MCP (available everywhere):{
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
WindsurfEdit ~/.codeium/windsurf/mcp_config.json directly (macOS/Linux) or%USERPROFILE%\.codeium\windsurf\mcp_config.json (Windows) — or open itvia the hammer icon in Cascade → Configure:{
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
Cline (VS Code extension)Open the Cline sidebar → MCP Servers icon → "Edit MCP Settings" (orcline_mcp_settings.json directly), same mcpServers shape:{
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
VS Code (GitHub Copilot)VS Code can add an MCP server straight from the command line:code --add-mcp '{"name":"payway","command":"npx","args":["-y","aba-payway-mcp"],"env":{"PAYWAY_MERCHANT_ID":"your_merchant_id","PAYWAY_API_KEY":"your_api_key","PAYWAY_ENV":"sandbox"}}'
Or via the Command Palette → MCP: Add Server, or by hand in.vscode/mcp.json (workspace) / user mcp.json (global):{
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
Gemini CLIGemini CLI also has a native add subcommand:gemini mcp add payway \
  -e PAYWAY_MERCHANT_ID=your_merchant_id \
  -e PAYWAY_API_KEY=your_api_key \
  -e PAYWAY_ENV=sandbox \
  -- npx -y aba-payway-mcp
-s user (default project) makes it available across all your projectsinstead of just the current one:gemini mcp add -s user payway -e PAYWAY_MERCHANT_ID=your_merchant_id -e PAYWAY_API_KEY=your_api_key -- npx -y aba-payway-mcp
This writes to ~/.gemini/settings.json (user) or .gemini/settings.json(project).Any other MCP clientIf your tool isn't listed above, it almost certainly still reads the sameshape — an mcpServers (or servers) object with command, args, andenv:{
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
Point command at node with the absolute path to src/index.js insteadof npx if you're running from a local clone rather than a published npmpackage. Check your client's docs for the exact config file path and keyname (mcpServers vs servers is the main variant).Local Smoke Test (No Live PayWay Credentials Needed)npm test
This spawns the server over stdio, does the MCP initialize handshake,lists all 11 tools, and calls payway_exchange_rate with dummy credentialsto confirm the hashing/config code path runs (it'll get a network/autherror against real PayWay, which is expected without real creds — thepoint is confirming nothing throws before that).Notes / gotchas carried over from the PayWay docspayway_purchase with no payment_option and hosted_view returns fullcheckout HTML (a redirect page) rather than JSON — that's normal PayWaybehavior, not a bug here.payway_check_transaction only works ≤7 days old; usepayway_get_transaction_details for older transactions.payway_get_transaction_list date range is capped at 3 days by PayWay.Refunds only work on COMPLETED/APPROVED transactions within 30 days.Amount/currency minimums (100 KHR / 0.01 USD, etc.) are enforced byPayWay itself, not duplicated here — check status.code in the responseif something's rejected.Project Layoutaba-payway-mcp/
├── package.json
├── src/
│   ├── index.js    # MCP server + all tool definitions
│   └── payway.js   # HMAC hashing / RSA encryption / HTTP client
├── test/           # stdio smoke tests, no live credentials required
├── .env.example
└── .github/workflows/ci.yml
ContributingThis is an open-source, community-maintained project — issues and PRswelcome, especially for the remaining PayWay sections not yet covered(Credentials on File / tokenized payments, Pre-auth capture flow,multi-party Payout, Shopify/WooCommerce/Prestashop plugin helpers).Disclaimeraba-payway-mcp is an unofficial, independently developedintegration. It is not created by, affiliated with, or endorsed by ABABank or PayWay. "PayWay" and "ABA" are trademarks of their respectiveowners. Provided as-is, with no warranty — see LICENSE.LicenseMIT — free and open source. See LICENSE.
