import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  applicationQueue,
  dailyJobHuntQueue,
  complianceFilterQueue,
  coachHandoffQueue,
  profileIngestionQueue,
} from "./queue";

const serverAdapter = new ExpressAdapter();

const queues = [
  applicationQueue,
  dailyJobHuntQueue,
  complianceFilterQueue,
  coachHandoffQueue,
  profileIngestionQueue,
];

createBullBoard({
  queues: queues.map((q) => new BullMQAdapter(q)),
  serverAdapter,
});

const app = express();
app.use("/admin/board", serverAdapter.getRouter());

const port = Number(process.env.BULL_BOARD_PORT) || 8001;

export function startBullBoard(): void {
  app.listen(port, () => {
    console.log(`[bull-board] UI running on http://localhost:${port}/admin/board`);
  });
}
