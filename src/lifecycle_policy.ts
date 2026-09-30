import { z } from "zod";

export const workOrderMailSchema = z.object({
  workOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  photoCount: z.number().int().nonnegative(),
  dispatchStatus: z.enum(["scheduled", "en_route", "arrived", "completed"]),
  technicianName: z.string().min(1),
  followUpDate: z.string().date().optional(),
});

export type WorkOrderMail = z.infer<typeof workOrderMailSchema>;
export type LifecycleStage = "photo_receipt" | "dispatch_update" | "technician_follow_up";

export type MailDecision = {
  stage: LifecycleStage;
  template_vars: Record<string, string | number>;
};

export function decideLifecycleMail(input: WorkOrderMail): MailDecision {
  if (input.dispatchStatus === "completed" && input.followUpDate) {
    return {
      stage: "technician_follow_up",
      template_vars: {
        work_order_id: input.workOrderId,
        customer_name: input.customerName,
        technician_name: input.technicianName,
        follow_up_date: input.followUpDate,
      },
    };
  }

  if (input.dispatchStatus === "scheduled" && input.photoCount > 0) {
    return {
      stage: "photo_receipt",
      template_vars: {
        work_order_id: input.workOrderId,
        customer_name: input.customerName,
        photo_count: input.photoCount,
      },
    };
  }

  return {
    stage: "dispatch_update",
    template_vars: {
      work_order_id: input.workOrderId,
      customer_name: input.customerName,
      dispatch_status: input.dispatchStatus,
      technician_name: input.technicianName,
    },
  };
}
