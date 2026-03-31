import { chromium } from "playwright";

const apiUrl = "http://127.0.0.1:3001/api";
const uiUrl = "http://127.0.0.1:5173";
const projectName = `Debug Smoke ${Date.now()}`;

async function req(path, init) {
  const res = await fetch(apiUrl + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return JSON.parse(text);
}

const project = await req("/projects", {
  method: "POST",
  body: JSON.stringify({ name: projectName }),
});
await req(`/projects/${project.id}/objects`, {
  method: "POST",
  body: JSON.stringify({
    name: "Dbg",
    width: 600,
    height: 720,
    depth: 560,
    color: "#8B7355",
  }),
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => console.log("console:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("pageerror:", err.message));
page.on("response", async (res) => {
  if (res.url().includes("/api/")) {
    console.log("response:", res.status(), res.request().method(), res.url());
    if (!res.ok()) console.log("body:", await res.text());
  }
});

await page.goto(uiUrl, { waitUntil: "networkidle" });
await page.locator("button").filter({ hasText: project.name }).first().click();
await page.waitForTimeout(3000);
console.log("body text after click:\n", await page.locator("body").innerText());
console.log("canvas count", await page.locator("canvas").count());
console.log(
  "body html snippet:\n",
  (await page.locator("body").innerHTML()).slice(0, 6000),
);

await browser.close();
await fetch(`${apiUrl}/projects/${project.id}`, { method: "DELETE" });

