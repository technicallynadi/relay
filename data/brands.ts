import type { Brand } from "@/lib/types";

// The real Neighborly 19-brand North American roster → trade. Public reference data
// (no API). This is the brand-capability subgraph the retriever filters over.
export const BRANDS: Brand[] = [
  { id: "mr_rooter", name: "Mr. Rooter Plumbing", trade: "plumbing", slug: "mr-rooter" },
  { id: "aire_serv", name: "Aire Serv", trade: "hvac", slug: "aire-serv" },
  { id: "mr_electric", name: "Mr. Electric", trade: "electrical", slug: "mr-electric" },
  { id: "molly_maid", name: "Molly Maid", trade: "cleaning", slug: "molly-maid" },
  { id: "mr_handyman", name: "Mr. Handyman", trade: "handyman", slug: "mr-handyman" },
  { id: "mr_appliance", name: "Mr. Appliance", trade: "appliance", slug: "mr-appliance" },
  { id: "glass_doctor", name: "Glass Doctor", trade: "glass", slug: "glass-doctor" },
  { id: "rainbow", name: "Rainbow Restoration", trade: "restoration", slug: "rainbow-restoration" },
  { id: "grounds_guys", name: "The Grounds Guys", trade: "landscaping", slug: "grounds-guys" },
  { id: "lawn_pride", name: "Lawn Pride", trade: "lawn", slug: "lawn-pride" },
  { id: "mosquito_joe", name: "Mosquito Joe", trade: "pest", slug: "mosquito-joe" },
  { id: "five_star_painting", name: "Five Star Painting", trade: "painting", slug: "five-star-painting" },
  { id: "window_genie", name: "Window Genie", trade: "windows", slug: "window-genie" },
  { id: "precision_garage", name: "Precision Garage Door", trade: "garage_door", slug: "precision-garage-door" },
  { id: "dryer_vent_wizard", name: "Dryer Vent Wizard", trade: "dryer_vent", slug: "dryer-vent-wizard" },
  { id: "shelfgenie", name: "ShelfGenie", trade: "shelving", slug: "shelfgenie" },
  { id: "junk_king", name: "Junk King", trade: "junk_removal", slug: "junk-king" },
  { id: "housemaster", name: "HouseMaster", trade: "inspection", slug: "housemaster" },
  { id: "real_property_mgmt", name: "Real Property Management", trade: "property_management", slug: "real-property-management" },
];

export const BRAND_BY_ID = new Map(BRANDS.map((b) => [b.id, b]));
