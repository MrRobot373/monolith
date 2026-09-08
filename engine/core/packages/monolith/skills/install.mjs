// Install MONOLITH's skills into a monolith skill root, resolving {{SKILL_DIR}} to
// the installed absolute path.
//
//   node install.mjs <target-skills-root>
//
// Why a copy instead of pointing `customSkillDirs` at the source: a skill that
// ships an executable has to tell the model where that executable IS. monolith does
// hand the model a "Base directory for this skill" line, but a small model
// ignores it and runs the relative path against its own working directory,
// which fails with `No such file or directory` (observed live with a 9B model).
// Substituting the real absolute path removes the arithmetic entirely.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
if (!target) {
  console.error("usage: node install.mjs <target-skills-root>");
  process.exit(1);
}

/** Skill bundles live one level down: <root>/<name>/SKILL.md. */
function skillNames(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "SKILL.md")))
    .map((entry) => entry.name);
}

let installed = 0;
for (const name of skillNames(HERE)) {
  const from = path.join(HERE, name);
  const to = path.join(target, name);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });

  // The placeholder must resolve to where the skill now LIVES, not its source.
  const manifest = path.join(to, "SKILL.md");
  const body = fs.readFileSync(manifest, "utf8");
  fs.writeFileSync(manifest, body.replaceAll("{{SKILL_DIR}}", to.replaceAll("\\", "/")), "utf8");

  console.log(`installed ${name} -> ${to}`);
  installed += 1;
}

if (installed === 0) {
  console.error(`no skill bundles found under ${HERE}`);
  process.exit(1);
}
console.log(`${installed} skill(s) installed`);
