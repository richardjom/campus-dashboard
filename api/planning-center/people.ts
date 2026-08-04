import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePlanningCenterRequest } from "../../server/planning-center-http";

export default async function handler(req: IncomingMessage & { body?: unknown; method?: string; url?: string }, res: ServerResponse<IncomingMessage>) {
  req.url = "/api/planning-center/people";
  await handlePlanningCenterRequest(req, res);
}
