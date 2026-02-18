import { Marked, type Tokens } from "marked";

/**
 * Escape special XML characters for use in attributes.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Check if a link href points to a Markdown file (relative .md link).
 */
function isMarkdownFileLink(href: string): boolean {
  try {
    const url = new URL(href, "http://dummy");
    // If the href parses as an absolute URL with a real host, it's external
    if (url.host !== "dummy") return false;
  } catch {
    // Not a valid URL — treat as relative
  }
  return /\.md(?:#.*)?$/.test(href);
}

/**
 * Extract the page title from a .md link href.
 * Strips path, fragment, and .md extension.
 * E.g. "docs/sample-short.md#section" → "sample-short"
 */
function mdHrefToPageTitle(href: string): string {
  const withoutFragment = href.split("#")[0];
  return withoutFragment.split("/").pop()!.replace(/\.md$/, "");
}

/**
 * Escape content for use within CDATA sections.
 * The only problematic sequence in CDATA is "]]>" which closes the section.
 */
function escapeCdata(text: string): string {
  return text.replace(/]]>/g, "]]]]><![CDATA[>");
}

/**
 * Convert Markdown content to Confluence storage format (XHTML).
 *
 * Supports all standard Markdown features:
 * - Headings (h1-h6)
 * - Bold, italic, strikethrough inline formatting
 * - Links and images (images use Confluence ac:image macro)
 * - Ordered and unordered lists (including nested)
 * - Code blocks with syntax highlighting (uses Confluence code macro)
 * - Mermaid diagrams via ```mermaid code blocks
 * - Inline code
 * - Blockquotes
 * - Tables
 * - Horizontal rules
 *
 * @param markdown - The Markdown content to convert
 * @returns Confluence storage format (XHTML) string
 */
export function markdownToStorageFormat(markdown: string): string {
  const instance = new Marked();

  instance.use({
    renderer: {
      // Code blocks → Confluence structured-macro for code
      // This handles both regular code blocks and mermaid diagrams
      code({ text, lang }: Tokens.Code): string {
        const escapedText = escapeCdata(text);
        const langParam = lang
          ? `<ac:parameter ac:name="language">${escapeXml(lang)}</ac:parameter>`
          : "";
        return (
          `<ac:structured-macro ac:name="code">` +
          langParam +
          `<ac:plain-text-body><![CDATA[${escapedText}]]></ac:plain-text-body>` +
          `</ac:structured-macro>\n`
        );
      },

      // Images → Confluence ac:image macro with ri:url
      image({ href, title, text }: Tokens.Image): string {
        const altAttr = text ? ` ac:alt="${escapeXml(text)}"` : "";
        const titleAttr = title ? ` ac:title="${escapeXml(title)}"` : "";
        return (
          `<ac:image${altAttr}${titleAttr}>` +
          `<ri:url ri:value="${escapeXml(href)}" />` +
          `</ac:image>`
        );
      },

      // Links to .md files → Confluence ac:link macro with ri:page.
      // The filename (without .md) is used as the target page title.
      // E.g. [Season Highlights](sample-short.md) links to page titled "sample-short".
      link({ href, title, tokens }: Tokens.Link): string | false {
        if (href && isMarkdownFileLink(href)) {
          const pageTitle = mdHrefToPageTitle(href);
          const linkBody = this.parser.parseInline(tokens);
          const titleAttr = title
            ? ` ac:title="${escapeXml(title)}"`
            : "";
          return (
            `<ac:link${titleAttr}>` +
            `<ri:page ri:content-title="${escapeXml(pageTitle)}" />` +
            `<ac:link-body>${linkBody}</ac:link-body>` +
            `</ac:link>`
          );
        }
        return false; // fall back to default renderer for external links
      },

      // Ensure XHTML-compatible self-closing tag for horizontal rules
      hr(): string {
        return "<hr />\n";
      },
    },
  });

  return instance.parse(markdown, { async: false });
}
