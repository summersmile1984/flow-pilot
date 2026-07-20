import { isRecord } from "@/lib/utils";

/**
 * Coerce an untrusted MCP payload field into an array of records, dropping
 * malformed entries. MCP servers are external data sources — a field typed as
 * an array in our interfaces can arrive as anything.
 */
export function asRecordArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(isRecord) as T[]) : [];
}

/** Strip HTML tags and decode common entities */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
