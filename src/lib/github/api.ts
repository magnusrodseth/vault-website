const GITHUB_API_BASE = "https://api.github.com";

interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir" | "symlink" | "submodule";
}

async function fetchWithAuth(url: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { headers, cache: "no-store" });
}

async function listDirectoryContents(
  owner: string,
  repo: string,
  path = "",
  branch = "main",
): Promise<GitHubContentItem[]> {
  const encodedPath = path ? `/${encodeURIComponent(path)}` : "";
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents${encodedPath}?ref=${branch}`;

  const response = await fetchWithAuth(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${body}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

async function getAllMarkdownFilesRecursive(
  owner: string,
  repo: string,
  path = "",
  branch = "main",
): Promise<{ path: string; title: string }[]> {
  const contents = await listDirectoryContents(owner, repo, path, branch);
  const results: { path: string; title: string }[] = [];

  for (const item of contents) {
    if (item.name.startsWith(".")) continue;

    if (item.type === "file" && item.name.endsWith(".md")) {
      results.push({
        path: item.path,
        title: item.name.replace(/\.md$/, ""),
      });
    } else if (item.type === "dir" && !item.name.startsWith(".")) {
      const subFiles = await getAllMarkdownFilesRecursive(
        owner,
        repo,
        item.path,
        branch,
      );
      results.push(...subFiles);
    }
  }

  return results;
}

export async function getMarkdownFiles(): Promise<
  { path: string; title: string }[]
> {
  const repoPath = process.env.GITHUB_REPO;

  if (!repoPath) {
    throw new Error("GITHUB_REPO environment variable must be set");
  }

  const [owner, repo] = repoPath.split("/");

  if (!owner || !repo) {
    throw new Error("GITHUB_REPO must be in format 'owner/repo'");
  }

  return getAllMarkdownFilesRecursive(owner, repo);
}
