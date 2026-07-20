aba-payway-mcp
Open source. Unofficial. Community-built. This is not an ABA Bank or PayWay product, and it isn't endorsed, reviewed, or supported by them — it's an independent MCP wrapper around their publicly documented API. Use it at your own risk.
An MCP (Model Context Protocol) server that wraps ABA Bank's PayWay API (https://developer.payway.com.kh) so any MCP-compatible AI tool can create checkouts, generate KHQR codes, check/list transactions, issue refunds, create payment links, and pull exchange rates, directly from a chat or agent session.
Released under the MIT license — free to use, fork, modify, and redistribute.
Tools
Tool	PayWay endpoint	Notes
`payway_purchase`	Purchase	hosted checkout / popup / KHQR / cards / wallets
`payway_generate_qr`	ABA QR API — generate-qr	KHQR / WeChat / Alipay, no hosted page
`payway_check_transaction`	check-transaction-2	status, ≤7 days old
`payway_get_transaction_details`	transaction-detail	any age, full history, 10 req/min
`payway_get_transaction_list`	transaction-list-2	filtered list, ≤3 day range, 50 req/min
`payway_get_transactions_by_merchant_ref`	get-transactions-by-mc-ref	KHQR tag 62.01 lookup
`payway_close_transaction`	close-transaction	cancel a pending tx
`payway_refund`	online-transaction/refund	full/partial, ≤30 days, needs RSA key
`payway_exchange_rate`	exchange-rate	ABA buy/sell rates
`payway_create_payment_link`	payment-link/create	needs RSA key
`payway_get_payment_link_details`	payment-link/detail	needs RSA key
Install
Run instantly without cloning:
```bash
npx -y aba-payway-mcp
```
Or clone locally and build:
```bash
git clone https://github.com/sim0ple/aba-payway-mcp.git
cd aba-payway-mcp
npm install
```
Configuration
Set as environment variables in your MCP client's config:
Variable	Required	Notes
`PAYWAY_MERCHANT_ID`	yes	Your merchant key from ABA Bank
`PAYWAY_API_KEY`	yes	HMAC secret
`PAYWAY_ENV`	no	`sandbox` (default) or `production`
`PAYWAY_RSA_PUBLIC_KEY`	only for refund / payment-link	RSA public key PEM
Local smoke test
```bash
npm test
```
Disclaimer
`aba-payway-mcp` is an unofficial, independently developed integration. It is not created by, affiliated with, or endorsed by ABA Bank or PayWay.
