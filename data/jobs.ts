import { BRAND_BY_ID } from "@/data/brands";
import { extractSpecialties } from "@/lib/specialties";
import type { Job } from "@/lib/types";

// Three example completed-job events. The keys name the JOB, not the outcome — the
// decision is computed live by the jury gate (Kendall's W), never implied by the scenario.
export const JOBS: Job[] = [
  {
    id: "job_drain",
    scenarioKey: "drain-job",
    brandId: "mr_rooter",
    trade: "plumbing",
    location: { label: "Plano, TX", lat: 33.0198, lng: -96.6989 },
    summary: "Cleared a kitchen sink drain blockage",
    techNotes:
      "Drain runs clear now. But there's standing water and a saturated, swelling cabinet base under the sink — the particleboard is delaminating and there's a musty smell starting. Looks like a slow supply-line leak has been wetting the cabinet for a while.",
    neededSpecialties: ["water", "mold", "drying"],
  },
  {
    id: "job_ac",
    scenarioKey: "ac-tuneup",
    brandId: "aire_serv",
    trade: "hvac",
    location: { label: "Plano, TX", lat: 33.05, lng: -96.69 },
    summary: "Repaired the AC condenser and recharged refrigerant",
    techNotes:
      "AC is cooling again. Flagged that the electrical panel feeding the condenser is an older model and a couple of breakers were running hot to the touch; the homeowner should have an electrician evaluate the panel load before summer.",
    neededSpecialties: ["panel", "load", "upgrade"],
  },
  {
    id: "job_lint",
    scenarioKey: "deep-clean",
    brandId: "molly_maid",
    trade: "cleaning",
    location: { label: "Frisco, TX", lat: 33.1507, lng: -96.8236 },
    summary: "Finished a whole-home deep clean",
    techNotes:
      "Place looks great. One thing I flagged for the homeowner: the dryer vent is packed with lint and the wall behind it was warm to the touch — that's a real fire risk. They should get the vent cleaned and inspected soon.",
    neededSpecialties: ["dryer vent cleaning", "lint removal", "fire-risk inspection"],
  },
  {
    id: "job_dishwasher",
    scenarioKey: "appliance-install",
    brandId: "mr_appliance",
    trade: "appliance",
    location: { label: "Plano, TX", lat: 33.029, lng: -96.705 },
    summary: "Installed a new dishwasher",
    techNotes:
      "Dishwasher is in and running. The supply line shutoff behind it is corroded and weeping at the valve — I closed it for now, but they'll want a plumber to replace the supply line before it lets go.",
    neededSpecialties: ["supply line", "leak repair", "valve"],
  },
  {
    id: "job_inspection",
    scenarioKey: "home-inspection",
    brandId: "housemaster",
    trade: "inspection",
    location: { label: "Allen, TX", lat: 33.1032, lng: -96.6706 },
    summary: "Completed a pre-listing home inspection",
    techNotes:
      "Mostly clean report. The main electrical panel is an older model with a couple of double-tapped breakers and signs of heat at the bus — I'd recommend an electrician evaluate the panel before closing.",
    neededSpecialties: ["panel", "breaker", "code compliance"],
  },
  {
    id: "job_shelf",
    scenarioKey: "shelf-install",
    brandId: "mr_handyman",
    trade: "handyman",
    location: { label: "Plano, TX", lat: 33.03, lng: -96.71 },
    summary: "Mounted three floating shelves and a TV bracket",
    techNotes:
      "Clean install — located the studs, everything level and anchored. Customer happy, nothing else flagged.",
    neededSpecialties: [],
  },
];

export const JOB_BY_SCENARIO = new Map(JOBS.map((j) => [j.scenarioKey, j]));

// Compose a completed-job event on the spot (the un-scripted path). The performing
// brand fixes the trade; a default location anchors the proximity score.
// neededSpecialties is left empty — fit comes from pgvector over the tech notes.
export function buildCustomJob(brandId: string, techNotes: string, summary?: string): Job {
  const brand = BRAND_BY_ID.get(brandId);
  return {
    id: `job_custom_${Date.now()}`,
    scenarioKey: "custom",
    brandId,
    trade: brand?.trade ?? "handyman",
    location: { label: "Plano, TX", lat: 33.0198, lng: -96.6989 },
    summary: summary?.trim() || (brand ? `Completed a ${brand.name} job` : "Completed a job"),
    techNotes,
    neededSpecialties: extractSpecialties(techNotes),
  };
}
