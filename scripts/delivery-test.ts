// Verify the delivery seam in isolation (run: `bun run scripts/delivery-test.ts`).
import { deliver } from "@/lib/delivery";

const res = await deliver({
  message: "Hi Dana — while clearing your drain our tech noticed water in the cabinet base…",
  partnerName: "Rainbow Restoration",
});
console.log(res);
