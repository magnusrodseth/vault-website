import simpleGit from "simple-git";
import { existsSync } from "fs";

const VAULT_PATH = process.env.VAULT_PATH || "/tmp/vault";
const REPO_URL = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO}.git`;

export async function syncVault() {
  const git = simpleGit();

  if (existsSync(VAULT_PATH)) {
    await git.cwd(VAULT_PATH).pull();
    return { status: "pulled", path: VAULT_PATH };
  }
  await git.clone(REPO_URL, VAULT_PATH, ["--depth", "1"]);
  return { status: "cloned", path: VAULT_PATH };
}

export async function pushChanges(message: string) {
  const git = simpleGit(VAULT_PATH);
  await git.add(".");
  await git.commit(message);
  await git.push();
}

export function getVaultPath() {
  return VAULT_PATH;
}
