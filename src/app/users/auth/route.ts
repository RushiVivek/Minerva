import { authenticateKosync, kosyncError } from "@/lib/kosync";

export async function GET(request: Request) {
  const user = await authenticateKosync(request);
  return user
    ? Response.json({ authorized: "OK" })
    : kosyncError("Unauthorized", 2001, 401);
}
