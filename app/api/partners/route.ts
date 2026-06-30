import { PARTNERS } from "@/data/partners";
import { partnerSource } from "@/lib/places";

export const runtime = "nodejs";

// The in-network + local partner directory (seeded behind the Google-Places adapter
// seam). Shapes the Partners view.
export function GET() {
  return Response.json({
    source: partnerSource(),
    partners: PARTNERS.map((p) => ({
      id: p.id,
      name: p.name,
      trade: p.trade,
      inNetwork: p.brandId != null,
      rating: p.rating,
      reviewCount: p.reviewCount,
      capacity: p.capacityStatus,
      specialties: p.specialties,
      summary: p.capabilitySheet,
    })),
  });
}
