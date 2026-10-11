export type LeadJob = { leadId: string; force?: boolean };

export async function enqueueLeads(queue: Queue<LeadJob>, leadIds: string[], force = false) {
  // sendBatch accepts at most 100 messages per call.
  for (let i = 0; i < leadIds.length; i += 100) {
    await queue.sendBatch(
      leadIds.slice(i, i + 100).map((leadId) => ({ body: force ? { leadId, force } : { leadId } })),
    );
  }
}
