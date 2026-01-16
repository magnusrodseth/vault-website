import { Octokit } from "octokit";

interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

function getRepoConfig(): RepoConfig {
  const repoPath = process.env.GITHUB_REPO;
  if (!repoPath) {
    throw new Error("GITHUB_REPO environment variable must be set");
  }
  const [owner, repo] = repoPath.split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPO must be in format 'owner/repo'");
  }
  return { owner, repo, branch: "main" };
}

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable must be set");
  }
  return new Octokit({ auth: token });
}

export async function listDirectory(
  folder?: string,
): Promise<{ name: string; path: string; type: "file" | "dir" }[]> {
  const { owner, repo, branch } = getRepoConfig();
  const octokit = getOctokit();

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: folder || "",
    ref: branch,
  });

  if (!Array.isArray(data)) {
    throw new Error(`Path is not a directory: ${folder}`);
  }

  return data
    .filter((item) => !item.name.startsWith("."))
    .map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === "dir" ? "dir" : "file",
    }));
}

export async function readFileContent(path: string): Promise<string> {
  const { owner, repo, branch } = getRepoConfig();
  const octokit = getOctokit();

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path is not a file: ${path}`);
  }

  if (!("content" in data) || !data.content) {
    throw new Error(`File has no content: ${path}`);
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function createOrUpdateFile(
  path: string,
  content: string,
  message: string,
): Promise<{ path: string; sha: string; created: boolean }> {
  const { owner, repo, branch } = getRepoConfig();
  const octokit = getOctokit();

  let existingSha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (!Array.isArray(data) && data.type === "file") {
      existingSha = data.sha;
    }
  } catch (error) {
    if ((error as { status?: number }).status !== 404) {
      throw error;
    }
  }

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
    sha: existingSha,
  });

  return {
    path: data.content?.path || path,
    sha: data.content?.sha || "",
    created: !existingSha,
  };
}

async function listDirectoryRecursive(
  folder: string,
): Promise<{ path: string; title: string }[]> {
  const { owner, repo, branch } = getRepoConfig();
  const octokit = getOctokit();

  const results: { path: string; title: string }[] = [];

  async function traverse(currentPath: string): Promise<void> {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: currentPath,
      ref: branch,
    });

    if (!Array.isArray(data)) return;

    for (const item of data) {
      if (item.name.startsWith(".")) continue;

      if (item.type === "file" && item.name.endsWith(".md")) {
        results.push({
          path: item.path,
          title: item.name.replace(/\.md$/, ""),
        });
      } else if (item.type === "dir") {
        await traverse(item.path);
      }
    }
  }

  await traverse(folder);
  return results;
}

export async function getMarkdownFiles(): Promise<
  { path: string; title: string }[]
> {
  return listDirectoryRecursive("");
}
