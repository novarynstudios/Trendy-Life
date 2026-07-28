# Payment gateway integration

The Trendy Life storefront exposes three payment options:

1. **SSLCommerz** — configured with `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, and `SSLCOMMERZ_IS_LIVE`. Production mode uses the secure-pay host; development defaults to the sandbox host.
2. **UddoktaPay** — configured with `UDDOKTAPAY_BASE_URL` and `UDDOKTAPAY_API_KEY`.
3. **Cash on Delivery** — creates an unpaid order with no gateway session or payment attempt.

Bank transfer and other offline entries are not checkout options. Authorized finance staff can still record a manual payment in the admin panel for reconciliation and support workflows.

## Verification model

- Payment sessions are created only by the server.
- Gateway credentials are never sent to the browser.
- SSLCommerz success callbacks and IPNs are revalidated through the vendor Order Validation API. The local transaction ID, amount, BDT currency, status, and risk level must all match before an order becomes paid.
- UddoktaPay callbacks and webhooks are verified against the vendor API using the server-side invoice ID.
- Repeated success/IPN delivery is idempotent, and local writes run inside a database transaction.
- Stored payloads are restricted to operational fields; payment credentials, OTPs, PANs, and CVVs are never stored.
- Failed and cancelled callbacks cannot mark an order paid.

The legacy generic intake route `POST /api/webhooks/{gateway}` accepts only `sslcommerz` and `uddoktapay` adapter events. It validates timestamped HMAC signatures, prevents event replay with idempotency keys, records safe metadata, and queues processing. Vendor-specific checkout callbacks use their dedicated endpoints.

Before launch, run both vendors' sandbox certification flows, confirm callback/IPN allowlisting and public HTTPS URLs, reconcile settlement amounts, rotate credentials, and switch `SSLCOMMERZ_IS_LIVE=true` only after the live store is approved.
