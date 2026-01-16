import { readFile as fsReadFile } from "fs/promises";
import { join, dirname } from "path";
import { glob } from "glob";
import { mkdir, writeFile as fsWriteFile } from "fs/promises";

const VAULT_PATH = process.env.VAULT_PATH || "/tmp/vault";

export async function searchVault(query: string, folder?: string) {
  const pattern = folder ? `${folder}/**/*.md` : "**/*.md";
  const files = await glob(pattern, {
    cwd: VAULT_PATH,
    ignore: ["node_modules/**", ".git/**", ".obsidian/**"],
  });

  const results: { path: string; matches: string[] }[] = [];
  const regex = new RegExp(query, "gi");

  for (const file of files) {
    const content = await fsReadFile(join(VAULT_PATH, file), "utf-8");
    const lines = content.split("\n");
    const matches = lines.filter((line) => regex.test(line));

    if (matches.length > 0) {
      results.push({ path: file, matches: matches.slice(0, 3) });
    }
  }

  return results;
}

export async function readFile(path: string) {
  return fsReadFile(join(VAULT_PATH, path), "utf-8");
}

export async function listFiles(folder?: string) {
  const cwd = folder ? join(VAULT_PATH, folder) : VAULT_PATH;
  const files = await glob("**/*.md", {
    cwd,
    ignore: [".obsidian/**", ".git/**"],
  });
  return files;
}

export async function writeFile(path: string, content: string) {
  const fullPath = join(VAULT_PATH, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await fsWriteFile(fullPath, content, "utf-8");
}

export async function getAllNotes() {
  const files = await glob("**/*.md", {
    cwd: VAULT_PATH,
    ignore: ["node_modules/**", ".git/**", ".obsidian/**"],
  });

  return files.map((file) => ({
    path: file,
    title: file.replace(/\.md$/, "").split("/").pop() || file,
  }));
}
