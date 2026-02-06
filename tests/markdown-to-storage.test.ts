import { describe, it, expect } from "vitest";
import { markdownToStorageFormat } from "../src/utils/markdown-to-storage.js";

describe("markdownToStorageFormat", () => {
  describe("headings", () => {
    it("should convert h1-h6 headings", () => {
      expect(markdownToStorageFormat("# Heading 1")).toContain(
        "<h1>Heading 1</h1>"
      );
      expect(markdownToStorageFormat("## Heading 2")).toContain(
        "<h2>Heading 2</h2>"
      );
      expect(markdownToStorageFormat("### Heading 3")).toContain(
        "<h3>Heading 3</h3>"
      );
      expect(markdownToStorageFormat("#### Heading 4")).toContain(
        "<h4>Heading 4</h4>"
      );
      expect(markdownToStorageFormat("##### Heading 5")).toContain(
        "<h5>Heading 5</h5>"
      );
      expect(markdownToStorageFormat("###### Heading 6")).toContain(
        "<h6>Heading 6</h6>"
      );
    });
  });

  describe("inline formatting", () => {
    it("should convert bold text", () => {
      const result = markdownToStorageFormat("This is **bold** text");
      expect(result).toContain("<strong>bold</strong>");
    });

    it("should convert italic text", () => {
      const result = markdownToStorageFormat("This is *italic* text");
      expect(result).toContain("<em>italic</em>");
    });

    it("should convert strikethrough text", () => {
      const result = markdownToStorageFormat("This is ~~deleted~~ text");
      expect(result).toContain("<del>deleted</del>");
    });

    it("should convert inline code", () => {
      const result = markdownToStorageFormat("Use `console.log()` here");
      expect(result).toContain("<code>console.log()</code>");
    });
  });

  describe("links", () => {
    it("should convert markdown links", () => {
      const result = markdownToStorageFormat(
        "[Click here](https://example.com)"
      );
      expect(result).toContain(
        '<a href="https://example.com">Click here</a>'
      );
    });

    it("should convert links with titles", () => {
      const result = markdownToStorageFormat(
        '[Click here](https://example.com "My Title")'
      );
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain("Click here");
    });
  });

  describe("images", () => {
    it("should convert images to Confluence ac:image macro", () => {
      const result = markdownToStorageFormat(
        "![Alt text](https://example.com/image.png)"
      );
      expect(result).toContain("<ac:image");
      expect(result).toContain('ac:alt="Alt text"');
      expect(result).toContain(
        '<ri:url ri:value="https://example.com/image.png" />'
      );
      expect(result).toContain("</ac:image>");
    });

    it("should convert images with titles", () => {
      const result = markdownToStorageFormat(
        '![Alt text](https://example.com/image.png "Image Title")'
      );
      expect(result).toContain('ac:alt="Alt text"');
      expect(result).toContain('ac:title="Image Title"');
      expect(result).toContain(
        '<ri:url ri:value="https://example.com/image.png" />'
      );
    });

    it("should not produce <img> tags", () => {
      const result = markdownToStorageFormat(
        "![Alt](https://example.com/img.png)"
      );
      expect(result).not.toContain("<img");
    });
  });

  describe("lists", () => {
    it("should convert unordered lists", () => {
      const result = markdownToStorageFormat("- Item 1\n- Item 2\n- Item 3");
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Item 1</li>");
      expect(result).toContain("<li>Item 2</li>");
      expect(result).toContain("<li>Item 3</li>");
      expect(result).toContain("</ul>");
    });

    it("should convert ordered lists", () => {
      const result = markdownToStorageFormat(
        "1. First\n2. Second\n3. Third"
      );
      expect(result).toContain("<ol>");
      expect(result).toContain("<li>First</li>");
      expect(result).toContain("<li>Second</li>");
      expect(result).toContain("<li>Third</li>");
      expect(result).toContain("</ol>");
    });
  });

  describe("code blocks", () => {
    it("should convert code blocks to Confluence code macro", () => {
      const result = markdownToStorageFormat(
        '```javascript\nconsole.log("hello");\n```'
      );
      expect(result).toContain(
        '<ac:structured-macro ac:name="code">'
      );
      expect(result).toContain(
        '<ac:parameter ac:name="language">javascript</ac:parameter>'
      );
      expect(result).toContain("<ac:plain-text-body><![CDATA[");
      expect(result).toContain('console.log("hello");');
      expect(result).toContain("]]></ac:plain-text-body>");
      expect(result).toContain("</ac:structured-macro>");
    });

    it("should convert code blocks without language", () => {
      const result = markdownToStorageFormat("```\nsome code\n```");
      expect(result).toContain(
        '<ac:structured-macro ac:name="code">'
      );
      expect(result).not.toContain('ac:name="language"');
      expect(result).toContain("some code");
    });

    it("should not produce <pre><code> tags for code blocks", () => {
      const result = markdownToStorageFormat(
        "```python\nprint('hello')\n```"
      );
      expect(result).not.toContain("<pre>");
      expect(result).toContain('<ac:structured-macro ac:name="code">');
    });

    it("should handle CDATA escape sequences in code blocks", () => {
      const result = markdownToStorageFormat("```\nfoo ]]> bar\n```");
      // The raw ]]> should not appear unescaped inside CDATA
      // It should be split as ]]]]><![CDATA[> to avoid premature CDATA close
      expect(result).toContain("]]]]><![CDATA[>");
      expect(result).toContain("foo ");
      expect(result).toContain(" bar");
    });
  });

  describe("mermaid diagrams", () => {
    it("should convert mermaid code blocks to Confluence code macro with mermaid language", () => {
      const mermaidContent = "graph TD\n    A --> B\n    B --> C";
      const result = markdownToStorageFormat(
        "```mermaid\n" + mermaidContent + "\n```"
      );
      expect(result).toContain(
        '<ac:structured-macro ac:name="code">'
      );
      expect(result).toContain(
        '<ac:parameter ac:name="language">mermaid</ac:parameter>'
      );
      expect(result).toContain("graph TD");
      expect(result).toContain("A --> B");
      expect(result).toContain("</ac:structured-macro>");
    });

    it("should handle complex mermaid diagrams", () => {
      const mermaid = [
        "```mermaid",
        "sequenceDiagram",
        "    Alice->>John: Hello John",
        '    John-->>Alice: Great!',
        "```",
      ].join("\n");
      const result = markdownToStorageFormat(mermaid);
      expect(result).toContain(
        '<ac:parameter ac:name="language">mermaid</ac:parameter>'
      );
      expect(result).toContain("sequenceDiagram");
      expect(result).toContain("Alice->>John: Hello John");
    });
  });

  describe("blockquotes", () => {
    it("should convert blockquotes", () => {
      const result = markdownToStorageFormat("> This is a quote");
      expect(result).toContain("<blockquote>");
      expect(result).toContain("This is a quote");
      expect(result).toContain("</blockquote>");
    });
  });

  describe("horizontal rules", () => {
    it("should convert horizontal rules to self-closing XHTML tag", () => {
      const result = markdownToStorageFormat("---");
      expect(result).toContain("<hr />");
    });
  });

  describe("tables", () => {
    it("should convert markdown tables to HTML tables", () => {
      const table =
        "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |";
      const result = markdownToStorageFormat(table);
      expect(result).toContain("<table>");
      expect(result).toContain("<th>Header 1</th>");
      expect(result).toContain("<th>Header 2</th>");
      expect(result).toContain("<td>Cell 1</td>");
      expect(result).toContain("<td>Cell 2</td>");
      expect(result).toContain("</table>");
    });
  });

  describe("paragraphs", () => {
    it("should wrap text in paragraph tags", () => {
      const result = markdownToStorageFormat("Hello world");
      expect(result).toContain("<p>Hello world</p>");
    });

    it("should separate paragraphs", () => {
      const result = markdownToStorageFormat(
        "First paragraph\n\nSecond paragraph"
      );
      expect(result).toContain("<p>First paragraph</p>");
      expect(result).toContain("<p>Second paragraph</p>");
    });
  });

  describe("complex documents", () => {
    it("should convert a full markdown document", () => {
      const markdown = [
        "# Project Overview",
        "",
        "This is a **bold** statement with *italic* text.",
        "",
        "## Features",
        "",
        "- Feature 1",
        "- Feature 2",
        "- Feature 3",
        "",
        "### Code Example",
        "",
        "```typescript",
        'const greeting = "hello";',
        "console.log(greeting);",
        "```",
        "",
        "### Architecture Diagram",
        "",
        "```mermaid",
        "graph LR",
        "    A[Client] --> B[Server]",
        "    B --> C[Database]",
        "```",
        "",
        "| Column A | Column B |",
        "| -------- | -------- |",
        "| Value 1  | Value 2  |",
        "",
        "---",
        "",
        "Visit [our site](https://example.com) for more info.",
      ].join("\n");

      const result = markdownToStorageFormat(markdown);

      // Headings
      expect(result).toContain("<h1>Project Overview</h1>");
      expect(result).toContain("<h2>Features</h2>");
      expect(result).toContain("<h3>Code Example</h3>");

      // Inline formatting
      expect(result).toContain("<strong>bold</strong>");
      expect(result).toContain("<em>italic</em>");

      // List
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Feature 1</li>");

      // Code block with language
      expect(result).toContain(
        '<ac:parameter ac:name="language">typescript</ac:parameter>'
      );
      expect(result).toContain('const greeting = "hello"');

      // Mermaid diagram
      expect(result).toContain(
        '<ac:parameter ac:name="language">mermaid</ac:parameter>'
      );
      expect(result).toContain("graph LR");

      // Table
      expect(result).toContain("<table>");
      expect(result).toContain("<th>Column A</th>");

      // Horizontal rule
      expect(result).toContain("<hr />");

      // Link
      expect(result).toContain('<a href="https://example.com">our site</a>');
    });
  });
});
