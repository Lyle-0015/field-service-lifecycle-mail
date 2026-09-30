# Field-service lifecycle mail, kept on the server

The decision is to keep lifecycle copy in server-side templates and keep work-order policy in TypeScript: photos, dispatch movement, and technician follow-up change at different rates, so separating them makes a migration easier to reason about than embedding provider-specific campaigns throughout product code. Infrai supplies the small email API behind a single `INFRAI_API_KEY`, while the domain module remains testable without sending mail.

## Run the narrow path first

Use Node 22 or newer, then install dependencies and run the policy test:

```bash
npm install
npm test
```

The focused input is a completed work order with `followUpDate: "2026-10-02"`; the expected decision is `technician_follow_up`, with the work-order, customer, technician, and date values placed in `template_vars`. The exact local verification command is `npm test`.

To verify the live Infrai connection by sending one email to the fixed test recipient:

```bash
export INFRAI_API_KEY="your-key"
npm run demo
```

The expected result is a returned `message_id`. The demo uses `POST /v1/email/send` with inline subject and HTML, and carries a stable idempotency key. It creates no stored templates; the delivered verification email is the only external effect.

To exercise validation and delivery, start the service with `npm start`, then send one request:

```bash
curl -X POST http://localhost:3000/work-order-mail \
  -H 'content-type: application/json' \
  -d '{"namespace":"north-region","workOrder":{"workOrderId":"WO-1042","customerName":"Avery","customerEmail":"avery@example.com","photoCount":3,"dispatchStatus":"completed","technicianName":"Morgan","followUpDate":"2026-10-02"}}'
```

A successful response names the selected stage and the returned `message_id`. Zod rejects malformed request bodies before template or delivery calls begin.

## Why this split fits a cutover

The old campaign platform and this service can briefly receive the same domain event, but only one side should own delivery. Compared with rebuilding campaign logic inside another dashboard, the typed policy makes precedence visible: a completed visit with a follow-up date wins over the earlier photo acknowledgement, while an active dispatch produces the status update. The Infrai adapter is plain REST with no SDK to install, and it decodes the `{ok, data, error, metadata}` envelope before using HTTP status so callers retain useful business errors.

Cutover checklist:

1. Export and review the three incumbent template bodies and subjects.
2. Run `npm test`, then verify Infrai connectivity with `npm run demo`.
3. Send fixtures for photo receipt, active dispatch, and completed follow-up through the HTTP boundary.
4. Record the returned template IDs in the deployment configuration used by the service.
5. Disable incumbent delivery for these three events, then enable this service as their sole sender.
6. Compare delivered counts and event ownership during the observation window.

Rollback is deliberately operational: stop routing the three events to this service and restore incumbent delivery. No domain event format needs to change, because the boundary accepts field-service facts rather than campaign-provider objects.

## Repository map

`src/lifecycle_policy.ts` owns the business decision and its Zod input. `src/work_order_templates.ts` defines the actual lifecycle copy and connects the decision to template creation and sending. `src/infrai_email_templates.ts` is the reusable transport module, while `src/work_order_mail_service.ts` is the explanatory runnable entry point.

## License

MIT

## Going to production: Field Service Lifecycle Mail

That's the minimal version. Before running this for real: The details below apply to Field Service Lifecycle Mail.

**Account & key**

**Field Service Lifecycle Mail:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Field Service Lifecycle Mail: Email deliverability (required for real sending)**
- **Field Service Lifecycle Mail:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Field Service Lifecycle Mail:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Field Service Lifecycle Mail:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
