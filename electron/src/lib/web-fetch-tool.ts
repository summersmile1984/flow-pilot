import { createTool } from '@mastra/core/tools';

const MAX_CHARS = 8000;
const TIMEOUT_MS = 15_000;

/** Crude HTML → readable text: drop script/style, strip tags, collapse space. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lightweight network access for the supervisor: fetch one URL and return its
 * text. Web search and heavy browsing stay with the subagents (they bring
 * their own web tooling); this only covers "read that page/API before
 * deciding".
 */
export const webFetchTool = createTool({
  id: 'web_fetch',
  description: 'Fetch a URL (http/https) and return its readable text content, truncated. Use for reading a specific page or API response; for web search, delegate to a subagent.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The http(s) URL to fetch' },
    },
    required: ['url'],
  } as const,
  outputSchema: {
    type: 'object',
    properties: {
      output: { type: 'string', description: 'Readable text content of the response' },
    },
    required: ['output'],
  } as const,
  execute: async ({ url }: { url: string }) => {
    if (!/^https?:\/\//i.test(url)) {
      return { output: `Error: only http(s) URLs are supported, got: ${url}` };
    }
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Pilot/1.0 (+supervisor web_fetch)' },
      });
      const contentType = res.headers.get('content-type') ?? '';
      const body = await res.text();
      const text = contentType.includes('html') ? htmlToText(body) : body.trim();
      const truncated = text.length > MAX_CHARS
        ? `${text.slice(0, MAX_CHARS)}\n[truncated ${text.length - MAX_CHARS} chars]`
        : text;
      return { output: `HTTP ${res.status} ${contentType}\n${truncated}` };
    } catch (err) {
      return { output: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
});
