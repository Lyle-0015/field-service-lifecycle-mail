import type { LifecycleStage, WorkOrderMail } from "./lifecycle_policy.ts";
import { decideLifecycleMail } from "./lifecycle_policy.ts";
import { infrai, stableKey, type TemplateDefinition } from "./infrai_email_templates.ts";

const templateBodies: Record<LifecycleStage, Omit<TemplateDefinition, "name">> = {
  photo_receipt: {
    subject: "Photos received for work order {{work_order_id}}",
    html: "<p>Hi {{customer_name}},</p><p>We received {{photo_count}} photos for work order {{work_order_id}}.</p>",
  },
  dispatch_update: {
    subject: "Dispatch update for work order {{work_order_id}}",
    html: "<p>Hi {{customer_name}},</p><p>{{technician_name}} is now {{dispatch_status}} for work order {{work_order_id}}.</p>",
  },
  technician_follow_up: {
    subject: "Follow-up for work order {{work_order_id}}",
    html: "<p>Hi {{customer_name}},</p><p>{{technician_name}} will follow up on {{follow_up_date}} about work order {{work_order_id}}.</p>",
  },
};

export async function createLifecycleTemplates(namespace: string) {
  const entries = Object.entries(templateBodies) as Array<
    [LifecycleStage, Omit<TemplateDefinition, "name">]
  >;
  const created = await Promise.all(
    entries.map(async ([stage, body]) => {
      const name = `${namespace}-${stage}`;
      const template = await infrai.email.template.create(
        { name, ...body },
        stableKey(`template:${name}`),
      );
      return [stage, template.template_id] as const;
    }),
  );
  return Object.fromEntries(created) as Record<LifecycleStage, string>;
}

export async function sendWorkOrderMail(
  input: WorkOrderMail,
  templateIds: Record<LifecycleStage, string>,
) {
  const decision = decideLifecycleMail(input);
  const result = await infrai.email.send(
    {
      to: input.customerEmail,
      template_id: templateIds[decision.stage],
      template_vars: decision.template_vars,
    },
    stableKey(`work-order:${input.workOrderId}:${decision.stage}`),
  );
  return { stage: decision.stage, message_id: result.message_id };
}
