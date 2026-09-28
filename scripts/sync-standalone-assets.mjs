import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export function syncStandaloneAssets(projectRoot) {
  const root = resolve(projectRoot);
  const standalone = join(root, ".next", "standalone");
  for (const [source, destination] of [
    [join(root, ".next", "static"), join(standalone, ".next", "static")],
    [join(root, "public"), join(standalone, "public")],
    [join(root, "data", "course-offerings"), join(standalone, "data", "course-offerings")],
  ]) {
    if (!existsSync(source)) throw new Error(`Missing build asset directory: ${source}`);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    cpSync(source, destination, { recursive: true });
  }
}
