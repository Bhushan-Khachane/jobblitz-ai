import { eq } from "drizzle-orm";
import { schema, createDatabaseClient } from "@jobblitz/db";

const db = createDatabaseClient(process.env.DATABASE_URL!);

export interface ApplicationWithJob {
  title: string;
  company: string;
  location?: string;
  score?: number;
  salary_lpa?: number;
}

export async function sendApprovalRequest(
  userId: string,
  applicationId: string,
  jobData: ApplicationWithJob
): Promise<string> {
  const [user] = await db
    .select({ phone: schema.users.phone })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user?.phone) {
    throw new Error("User phone number not found");
  }

  const message = `🎯 *New Job Match!*\n\n*Role:* ${jobData.title}\n*Company:* ${jobData.company}\n*Location:* ${
    jobData.location || "N/A"
  }\n*Match Score:* ${jobData.score || "N/A"}%\n*Salary:* ${
    jobData.salary_lpa || "Competitive"
  } LPA\n\nReply *1* to Apply ✅\nReply *2* to Skip ⏭️`;

  console.log(`Sending WhatsApp message to ${user.phone}: ${message}`);

  const provider = process.env.WHATSAPP_PROVIDER; // twilio|cloudapi
  let waMessageId = `mock_${Date.now()}`;

  if (provider === "twilio") {
    // Twilio API call logic
  } else if (provider === "cloudapi") {
    // WA Cloud API call logic
  }

  // Store whatsapp_message_id in approvals table
  await db
    .update(schema.approvals)
    .set({ whatsappMessageId: waMessageId })
    .where(eq(schema.approvals.applicationId, applicationId));

  return waMessageId;
}
