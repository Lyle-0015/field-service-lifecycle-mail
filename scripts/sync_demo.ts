import { infrai, stableKey } from "../src/infrai_email_templates.ts";

const sent = await infrai.email.send(
  {
    to: "chenhua@changba.com",
    subject: "Field-service lifecycle mail verification",
    html: "<p>The field-service lifecycle mail demo completed successfully.</p>",
  },
  stableKey("field-ops-demo:chenhua@changba.com"),
);

console.log("Sent field-service verification email:", sent.message_id);
