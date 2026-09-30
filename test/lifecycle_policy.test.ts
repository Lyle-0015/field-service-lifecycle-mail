import assert from "node:assert/strict";
import test from "node:test";
import { decideLifecycleMail, workOrderMailSchema } from "../src/lifecycle_policy.ts";

test("a completed visit with a date selects technician follow-up", () => {
  const input = workOrderMailSchema.parse({
    workOrderId: "WO-1042",
    customerName: "Avery",
    customerEmail: "avery@example.com",
    photoCount: 3,
    dispatchStatus: "completed",
    technicianName: "Morgan",
    followUpDate: "2026-10-02",
  });

  assert.deepEqual(decideLifecycleMail(input), {
    stage: "technician_follow_up",
    template_vars: {
      work_order_id: "WO-1042",
      customer_name: "Avery",
      technician_name: "Morgan",
      follow_up_date: "2026-10-02",
    },
  });
});

test("a scheduled visit with photos acknowledges the evidence first", () => {
  const input = workOrderMailSchema.parse({
    workOrderId: "WO-1043",
    customerName: "Riley",
    customerEmail: "riley@example.com",
    photoCount: 2,
    dispatchStatus: "scheduled",
    technicianName: "Sam",
  });

  assert.equal(decideLifecycleMail(input).stage, "photo_receipt");
});
