// Verify each configured model slug works with the active key (run: `bun run scripts/check-models.ts`).
import { JUDGES } from "@/data/judges";
import { chat, chatProviderName } from "@/lib/models";

console.log(`provider: ${chatProviderName()}\n`);

const models = [
  ...JUDGES.map((j) => ({ label: j.name, model: j.model })),
  { label: "Composer", model: process.env.COMPOSER_MODEL || "openai/gpt-4o-mini" },
];

for (const { label, model } of models) {
  try {
    const out = await chat({ model, system: "Reply with exactly: OK", user: "ping", temperature: 0 });
    console.log(`OK   ${label.padEnd(14)} ${model.padEnd(42)} → ${out.slice(0, 24).replace(/\n/g, " ")}`);
  } catch (e) {
    console.log(`FAIL ${label.padEnd(14)} ${model.padEnd(42)} → ${String(e).slice(0, 110).replace(/\n/g, " ")}`);
  }
}
