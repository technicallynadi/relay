// Partner-sourcing seam. With a Google Places key, pull live local businesses for the
// target trade near the job; otherwise use the seeded partner graph. Same Partner shape
// either way, so retrieval + the committee are identical — this is the production swap.

import { PARTNERS } from "@/data/partners";
import type { CapacityStatus, JobLocation, Partner, Trade } from "@/lib/types";

export type PartnerSource = "seed" | "google_places";

export function partnerSource(): PartnerSource {
  return process.env.GOOGLE_PLACES_API_KEY ? "google_places" : "seed";
}

// Trade → a natural-language Places query.
const TRADE_QUERY: Partial<Record<Trade, string>> = {
  restoration: "water damage restoration company",
  electrical: "electrician",
  plumbing: "plumber",
  hvac: "hvac contractor",
  dryer_vent: "dryer vent cleaning service",
  cleaning: "house cleaning service",
  pest: "pest control",
  landscaping: "landscaping company",
  appliance: "appliance repair",
  glass: "glass repair",
};

// The provider. Returns partners for `trade` near `location`.
export async function getPartners(trade: Trade, location: JobLocation): Promise<Partner[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (key) {
    try {
      const live = await fetchFromPlaces(trade, location, key);
      if (live.length > 0) return live;
    } catch {
      // network/quota error → fall back to the seeded graph
    }
  }
  return PARTNERS.filter((p) => p.trade === trade);
}

interface PlaceResult {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  editorialSummary?: { text?: string };
}

// Google Places API (New) Text Search, biased to the job's location.
async function fetchFromPlaces(trade: Trade, location: JobLocation, key: string): Promise<Partner[]> {
  const query = TRADE_QUERY[trade] ?? String(trade).replace(/_/g, " ");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.userRatingCount,places.location,places.editorialSummary",
    },
    body: JSON.stringify({
      textQuery: `${query} near ${location.label}`,
      locationBias: {
        circle: { center: { latitude: location.lat, longitude: location.lng }, radius: 20000 },
      },
      maxResultCount: 6,
    }),
  });
  if (!res.ok) throw new Error(`Places ${res.status}`);
  const data = (await res.json()) as { places?: PlaceResult[] };
  return (data.places ?? []).map((p, i) => mapPlaceToPartner(p, trade, i));
}

function mapPlaceToPartner(p: PlaceResult, trade: Trade, i: number): Partner {
  const name = p.displayName?.text ?? "Local provider";
  return {
    id: `places_${p.id ?? i}`,
    name,
    brandId: null, // Places businesses are out-of-network local partners
    trade,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating: typeof p.rating === "number" ? p.rating : 4.2,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
    capacityStatus: "this_week" as CapacityStatus,
    capabilitySheet:
      p.editorialSummary?.text ?? `${name} — ${trade.replace(/_/g, " ")} services near ${i === 0 ? "you" : "the job"}.`,
    reviews: [],
    specialties: [trade.replace(/_/g, " ")],
  };
}
