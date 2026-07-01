// Shared types for the opportunity flow. The interactive job console this file once
// held was superseded by the live OpportunityBoard; these remain the canonical shapes
// imported across the app.

export type RouteTarget = { brandId: string; techNotes: string; summary?: string };

export interface SeededJob {
  id: string;
  brandId: string;
  trade: string;
  summary: string;
  techNotes: string;
  location: string;
}

export interface BrandOpt {
  id: string;
  name: string;
  trade: string;
}
