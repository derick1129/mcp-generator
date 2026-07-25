import { MCPProject } from "../models/types.ts";
import Handlebars from "handlebars";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const templateMap: Record<string, string> = {
  "package.json": "package.json.hbs",
  "tsconfig.json": "tsconfig.json.hbs",
  "bunfig.toml": "bunfig.toml.hbs",
  ".env.example": "env.example.hbs",
  "README.md": "README.md.hbs"
};

export async function generateProjectBoilerplate(project: MCPProject, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });

  for (const [filename, templateName] of Object.entries(templateMap)) {
    const templatePath = join(import.meta.dir, "../../templates", templateName);
    const templateContent = await Bun.file(templatePath).text();
    const compiled = Handlebars.compile(templateContent);
    const result = compiled({
      name: project.name,
      version: project.version,
      baseUrl: project.baseUrl || "http://localhost:8000"
    });

    await writeFile(join(outDir, filename), result);
  }
}
