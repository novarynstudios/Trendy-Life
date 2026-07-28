# Courier integration guide

Adapter targets include Pathao, Steadfast, RedX, and Paperfly. Expose shipment creation, cancellation where supported, label retrieval, tracking, delivery events, COD, and return-to-origin state.

Normalize to Draft, Ready, Shipped, In transit, Delivered, Return to origin, or Cancelled. Use idempotency, encrypted credentials, validated callbacks, and BullMQ retries.

Match events to expected shipments, reject replays, preserve safe metadata, audit staff overrides, and reconcile COD payments. Confirm current vendor APIs and contracts before launch.
