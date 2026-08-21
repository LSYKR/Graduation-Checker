import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const DEFAULT_SITE_SLUGS = [
  "naoe", "oe", "energy", "ocean-aos", "dos", "dmb", "ocean-ope", "me",
  "eee", "elecom", "semi", "jeonpa", "di", "ca", "cls", "ene", "civil", "mmt",
];
const SITE_SLUGS = process.env.KMOU_AUDIT_SITE
  ? process.env.KMOU_AUDIT_SITE.split(",").map((value) => value.trim()).filter(Boolean)
  : DEFAULT_SITE_SLUGS;

const BASE = "https://www.kmou.ac.kr";
const execFileAsync = promisify(execFile);

const decodeHtml = (value) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

async function fetchText(url, options = {}) {
  const args = [
    "-L", "--silent", "--show-error", "--fail-with-body",
    "--connect-timeout", "10", "--max-time", "18", "--retry", "1", "--retry-all-errors", "--retry-delay", "1",
    "--user-agent", "KMOU-Graduation-Compass/0.22 source-audit",
  ];
  if (options.method === "POST") {
    args.push("-X", "POST", "--data", String(options.body));
  }
  args.push(url);
  try {
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 10 * 1024 * 1024, timeout: 40_000 });
    return stdout;
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.includes("<!DOCTYPE html")) return error.stdout;
    throw error;
  }
}

function discoverBoards(slug, html) {
  const boards = new Map();
  const anchorPattern = new RegExp(`<a[^>]+href="([^"]*/${slug}/na/ntt/selectNttList\\.do\\?[^"]+)"[^>]*>([\\s\\S]*?)<\\/a>`, "g");
  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1].replaceAll("&amp;", "&");
    const query = href.split("?", 2)[1];
    if (!query) continue;
    const params = new URLSearchParams(query);
    const mi = params.get("mi");
    const bbsId = params.get("bbsId");
    if (!mi || !bbsId) continue;
    const label = decodeHtml(match[2]);
    if (!/(공지사항|자료실|학사|학생)/.test(label)) continue;
    boards.set(bbsId, { slug, mi, bbsId, label });
  }
  return [...boards.values()];
}

function parsePosts(slug, html) {
  const posts = new Map();
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = rowMatch[1];
    const anchorPattern = new RegExp(`<a[^>]+href="([^"]*/${slug}/na/ntt/selectNttInfo\\.do\\?[^"]+)"[^>]*>([\\s\\S]*?)<\\/a>`);
    const anchor = row.match(anchorPattern);
    if (!anchor) continue;
    const href = anchor[1].replaceAll("&amp;", "&");
    const nttSn = new URL(href, BASE).searchParams.get("nttSn");
    const date = decodeHtml(row).match(/20\d{2}\.\d{2}\.\d{2}/)?.[0];
    if (!nttSn || !date) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) => decodeHtml(match[1]));
    const dateIndex = cells.findIndex((cell) => cell.includes(date));
    posts.set(nttSn, {
      nttSn,
      title: decodeHtml(anchor[2]),
      author: dateIndex > 0 ? cells[dateIndex - 1] : "",
      date,
    });
  }
  return [...posts.values()];
}

function parseAttachments(html) {
  const pattern = /<a[^>]+href="\/common\/nttFileDownload\.do\?fileKey=([a-f0-9]+)"[^>]*>([\s\S]*?)<\/a>/g;
  return [...html.matchAll(pattern)].map((match) => ({
    fileKey: match[1],
    name: decodeHtml(match[2]),
    url: `${BASE}/common/nttFileDownload.do?fileKey=${match[1]}`,
  }));
}

async function searchBoard(board, searchValue) {
  const params = new URLSearchParams({
    mi: board.mi,
    listCo: "100",
    bbsId: board.bbsId,
    searchType: "all",
    searchValue,
  });
  const html = await fetchText(`${BASE}/${board.slug}/na/ntt/selectNttList.do?${params}`);
  const posts = parsePosts(board.slug, html);
  if (process.env.KMOU_AUDIT_DEBUG === "1") {
    console.error(`${board.slug}:${board.bbsId}:${searchValue} bytes=${html.length} posts=${posts.length}`);
  }
  return posts;
}

async function auditSite(slug) {
  const mainHtml = await fetchText(`${BASE}/${slug}/main.do`);
  const boards = discoverBoards(slug, mainHtml);
  const candidates = new Map();
  const searches = boards.flatMap((board) => ["2022", "교육과정", "신입생", "졸업편제"].map((term) => ({ board, term })));
  const searchResults = await Promise.allSettled(searches.map(({ board, term }) => searchBoard(board, term)));
  searchResults.forEach((result, index) => {
    const { board, term } = searches[index];
    if (result.status === "rejected") {
      if (process.env.KMOU_AUDIT_DEBUG === "1") console.error(`${board.slug}:${board.bbsId}:${term} ${result.reason}`);
      return;
    }
    const found = result.value;
      for (const post of found) {
        if (!/(2022|교육과정|교과과정|신입생|수강|오리엔테이션|OT|참고자료)/i.test(post.title)) continue;
        const likely2022Cohort = /2022/.test(post.title)
          || (/^202(1\.1[12]|2\.0[1-4])\./.test(post.date) && /(교육과정|교과과정|신입생|수강|오리엔테이션|OT|참고자료)/i.test(post.title));
        if (!likely2022Cohort) continue;
        candidates.set(post.nttSn, { ...post, board });
      }
  });
  const candidateList = [...candidates.values()];
  const details = await Promise.allSettled(candidateList.map(async (candidate) => {
    const url = `${BASE}/${slug}/na/ntt/selectNttInfo.do?mi=${candidate.board.mi}&nttSn=${candidate.nttSn}`;
    const detailHtml = await fetchText(url);
    return { ...candidate, url, attachments: parseAttachments(detailHtml) };
  }));
  const posts = details.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  return { slug, boards, posts };
}

const results = [];
for (let offset = 0; offset < SITE_SLUGS.length; offset += 6) {
  const batch = SITE_SLUGS.slice(offset, offset + 6);
  const settled = await Promise.allSettled(batch.map(auditSite));
  settled.forEach((result, index) => {
    results.push(result.status === "fulfilled"
      ? result.value
      : { slug: batch[index], boards: [], posts: [], error: String(result.reason) });
  });
}

const outputPath = process.argv[2] ?? "/tmp/kmou-2022-curriculum-source-audit.json";
await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(outputPath);
console.log(`sites=${results.length} posts=${results.reduce((sum, item) => sum + item.posts.length, 0)} attachments=${results.reduce((sum, item) => sum + item.posts.reduce((inner, post) => inner + post.attachments.length, 0), 0)}`);
