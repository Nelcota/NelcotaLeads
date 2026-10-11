import type { LeadJob } from "@/server/queue";

/** Queue double that records the jobs sent (tests only); only sendBatch is used. */
export function createFakeQueue() {
  const sent: LeadJob[] = [];
  const queue = {
    sendBatch: async (messages: Iterable<MessageSendRequest<LeadJob>>) => {
      for (const message of messages) sent.push(message.body);
      return { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } };
    },
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { sent, queue: queue as Partial<Queue<LeadJob>> as Queue<LeadJob> };
}
