import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output);

for (const path of ["index.html", "styles.css", "app.js", "questions.js", "assets", "content"]) {
  await cp(new URL("../" + path, import.meta.url), new URL(path, output), { recursive: true });
}
