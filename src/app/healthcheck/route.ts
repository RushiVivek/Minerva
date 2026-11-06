import { KOSYNC_ACCEPT } from "@/lib/kosync";

export function GET(request: Request) {
  return Response.json(
    { state: "OK" },
    { headers: { "content-type": "application/json", "x-kosync-accept": KOSYNC_ACCEPT } },
  );
}
