// Smoke test for the Google Apps Script leaderboard Web App.
// Runs in Node (no CORS), verifies list + upsertMany.

const url = process.env.NEXT_PUBLIC_GAS_LEADERBOARD_URL;
const token = process.env.NEXT_PUBLIC_GAS_AUTH_TOKEN;

if (!url) {
  console.error("Missing NEXT_PUBLIC_GAS_LEADERBOARD_URL in env");
  process.exit(1);
}

async function getJson(params) {
  const qs = new URLSearchParams(params);
  if (token) qs.set("token", token);
  const full = `${url}${url.includes("?") ? "&" : "?"}${qs.toString()}`;
  const res = await fetch(full, { method: "GET" });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

const now = new Date().toISOString();
const testId = `name:smoketest`;
const entry = { id: testId, name: "SmokeTest", score: 1, createdAt: now, updatedAt: now };

console.log("Testing list...");
const list1 = await getJson({ action: "list" });
console.log("list status:", list1.status, "ok:", list1.ok, "body.ok:", list1.json?.ok);
if (!list1.ok || list1.json?.ok !== true || !Array.isArray(list1.json?.entries)) {
  console.error("List failed:", list1.text);
  process.exit(1);
}

console.log("Testing upsertMany...");
const upsert = await getJson({ action: "upsertMany", payload: JSON.stringify({ entries: [entry] }) });
console.log("upsert status:", upsert.status, "ok:", upsert.ok, "body.ok:", upsert.json?.ok);
if (!upsert.ok || upsert.json?.ok !== true || !Array.isArray(upsert.json?.entries)) {
  console.error("Upsert failed:", upsert.text);
  process.exit(1);
}

console.log("Re-listing...");
const list2 = await getJson({ action: "list" });
const found = (list2.json?.entries || []).find((e) => e?.id === testId);
if (!found) {
  console.error("Did not find inserted entry in list response");
  process.exit(1);
}

console.log("OK. Found entry:", found);

