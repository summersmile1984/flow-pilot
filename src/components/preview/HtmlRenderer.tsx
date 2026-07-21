/**
 * Render an HTML file as a page (not source) in a sandboxed iframe. Scripts are
 * disabled for safety; inline HTML/CSS renders. Self-contained pages (like the
 * office-cli reports) display fully; pages with relative assets show markup-only.
 */
export default function HtmlRenderer({ content }: { content: string }) {
  return (
    <iframe
      title="HTML preview"
      srcDoc={content}
      sandbox="allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  );
}
