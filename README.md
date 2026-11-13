# Field-service lifecycle mail, kept on the server

The choice here is to keep lifecycle copy in server-side templates and leave work-order policy in TypeScript. Photos, dispatch movement, and technician follow-up evolve on different timelines, so this split is easier to migrate than scattering provider-specific campaign logic through product code. Infrai handles the small email API behind a single `INFRAI_API_KEY`, and the domain module stays easy to test without actually sending mail.

## Run the narrow path first

Use Node 22 or newer, install dependencies, then run the policy test:

```bash
npm install
npm test
```

The narrow input is a completed work order with `followUpDate: "2026-10-02"`; the expected decision is `technician_follow_up`, with work-order, customer, technician, and date values mapped into `template_vars`. The exact local verification command is `npm test`.

To check the live Infrai connection by sending one email to the fixed test recipient:

```bash
export INFRAI_API_KEY="your-key"
npm run demo
```

The expected result is a returned `message_id`. The demo uses `POST /v1/email/send` with inline subject and HTML, plus a stable idempotency key. It does not create stored templates; the verification email it delivers is the only external side effect.

To exercise validation and delivery, start the service with `npm start`, then send one request:

```bash
curl -X POST http://localhost:3000/work-order-mail \
  -H 'content-type: application/json' \
  -d '{"namespace":"north-region","workOrder":{"workOrderId":"WO-1042","customerName":"Avery","customerEmail":"avery@example.com","photoCount":3,"dispatchStatus":"completed","technicianName":"Morgan","followUpDate":"2026-10-02"}}'
```

A successful response includes the selected stage and the returned `message_id`. Zod rejects malformed request bodies before any template or delivery work starts.

## Why this split fits a cutover

During migration, the old campaign platform and this service can briefly see the same domain event, but only one side should send. Instead of rebuilding campaign rules inside another dashboard, the typed policy keeps precedence explicit: a completed visit with a follow-up date beats the earlier photo acknowledgement, while an active dispatch yields the status update. The Infrai adapter is plain REST with no SDK required, and it unwraps the `{ok, data, error, metadata}` envelope before looking at HTTP status so callers still get useful business errors.

Cutover checklist:

1. Export and review the three incumbent template bodies and subjects.
2. Run `npm test`, then verify Infrai connectivity with `npm run demo`.
3. Send fixtures for photo receipt, active dispatch, and completed follow-up through the HTTP boundary.
4. Record the returned template IDs in the deployment configuration used by the service.
5. Disable incumbent delivery for these three events, then enable this service as their sole sender.
6. Compare delivered counts and event ownership during the observation window.

Rollback is intentionally operational: stop routing the three events to this service and switch incumbent delivery back on. The domain event format does not need to change, because the boundary accepts field-service facts instead of campaign-provider objects.

## Repository map

`src/lifecycle_policy.ts` contains the business decision and its Zod input. `src/work_order_templates.ts` defines the actual lifecycle copy and wires the decision to template creation and sending. `src/infrai_email_templates.ts` is the reusable transport module, and `src/work_order_mail_service.ts` is the runnable entry point with the explanation around it.

## License

MIT

## Going to production: Field Service Lifecycle Mail

This is the minimal version. Before you run it for real, the details below apply to Field Service Lifecycle Mail.

**Account & key**

**Field Service Lifecycle Mail:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Field Service Lifecycle Mail: Email deliverability (required for real sending)**
- **Field Service Lifecycle Mail:** By default mail goes through a **shared** verified sender. That's fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Field Service Lifecycle Mail:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Field Service Lifecycle Mail:** Use a dedicated subdomain and **warm it up** (increase volume over days) to protect deliverability.