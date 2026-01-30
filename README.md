# Confluence MCP Server

A Model Context Protocol (MCP) server that provides AI models with full access to Confluence Cloud functionality via the REST API v2.

## Installation

Run directly from GitHub:

```bash
npx -y https://github.com/scottlepp/confluence-mcp
```

Or clone and build locally:

```bash
git clone https://github.com/scottlepp/confluence-mcp.git
cd confluence-mcp
npm install
npm run build
node build/index.js
```

## Configuration

Set the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| CONFLUENCE_HOST | Your Confluence instance URL (e.g., https://yourcompany.atlassian.net) | Yes |
| CONFLUENCE_EMAIL | Your Atlassian account email | Yes |
| CONFLUENCE_API_TOKEN | API token from [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens) | Yes |
| CONFLUENCE_CLOUD_ID | Cloud ID for scoped tokens (auto-fetched if not provided) | No |
| CONFLUENCE_ENABLED_CATEGORIES | Comma-separated list of tool categories to enable (default: all) | No |
| CONFLUENCE_DISABLED_TOOLS | Comma-separated list of specific tools to disable | No |

### Tool Filtering

You can limit which tools are exposed to the AI model using environment variables:

**Enable only specific categories:**

```bash
CONFLUENCE_ENABLED_CATEGORIES=page,space,search
```

**Disable specific tools (e.g., destructive operations):**

```bash
CONFLUENCE_DISABLED_TOOLS=confluence_delete_page,confluence_delete_space,confluence_delete_blog_post
```

**Available categories:** `page`, `space`, `blogPost`, `comment`, `attachment`, `label`, `search`, `user`, `version`, `contentProperty`, `ancestor`, `descendant`, `server`

## Claude Desktop Setup

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "confluence": {
      "command": "npx",
      "args": ["-y", "https://github.com/scottlepp/confluence-mcp"],
      "env": {
        "CONFLUENCE_HOST": "https://yourcompany.atlassian.net",
        "CONFLUENCE_EMAIL": "your-email@example.com",
        "CONFLUENCE_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

**With tool filtering (recommended for limited access):**

```json
{
  "mcpServers": {
    "confluence": {
      "command": "npx",
      "args": ["-y", "https://github.com/scottlepp/confluence-mcp"],
      "env": {
        "CONFLUENCE_HOST": "https://yourcompany.atlassian.net",
        "CONFLUENCE_EMAIL": "your-email@example.com",
        "CONFLUENCE_API_TOKEN": "your-api-token",
        "CONFLUENCE_ENABLED_CATEGORIES": "page,space,search,comment",
        "CONFLUENCE_DISABLED_TOOLS": "confluence_delete_page,confluence_delete_space"
      }
    }
  }
}
```

## Available Tools

### Pages

- `confluence_get_pages` - Get all pages with optional filters
- `confluence_get_page` - Get a specific page by ID
- `confluence_create_page` - Create a new page
- `confluence_update_page` - Update an existing page
- `confluence_delete_page` - Delete a page
- `confluence_get_pages_in_space` - Get all pages in a space
- `confluence_get_pages_for_label` - Get pages with a specific label

### Spaces

- `confluence_get_spaces` - List all accessible spaces
- `confluence_get_space` - Get space details
- `confluence_create_space` - Create a new space
- `confluence_update_space` - Update space
- `confluence_delete_space` - Delete space

### Blog Posts

- `confluence_get_blog_posts` - Get all blog posts
- `confluence_get_blog_post` - Get blog post details
- `confluence_create_blog_post` - Create a new blog post
- `confluence_update_blog_post` - Update blog post
- `confluence_delete_blog_post` - Delete blog post
- `confluence_get_blog_posts_in_space` - Get blog posts in a space

### Comments

- `confluence_get_page_footer_comments` - Get footer comments on a page
- `confluence_get_page_inline_comments` - Get inline comments on a page
- `confluence_get_blog_post_footer_comments` - Get footer comments on a blog post
- `confluence_get_footer_comment` - Get a specific comment
- `confluence_create_page_footer_comment` - Add comment to page
- `confluence_create_blog_post_footer_comment` - Add comment to blog post
- `confluence_update_footer_comment` - Update comment
- `confluence_delete_footer_comment` - Delete comment

### Attachments

- `confluence_get_page_attachments` - Get attachments on a page
- `confluence_get_blog_post_attachments` - Get attachments on a blog post
- `confluence_get_attachment` - Get attachment details
- `confluence_delete_attachment` - Delete attachment

### Labels

- `confluence_get_page_labels` - Get labels on a page
- `confluence_add_page_label` - Add label to page
- `confluence_remove_page_label` - Remove label from page
- `confluence_get_blog_post_labels` - Get labels on a blog post
- `confluence_add_blog_post_label` - Add label to blog post
- `confluence_remove_blog_post_label` - Remove label from blog post
- `confluence_get_space_labels` - Get labels on a space
- `confluence_add_space_label` - Add label to space
- `confluence_remove_space_label` - Remove label from space

### Search

- `confluence_cql_search` - Advanced search using CQL (Confluence Query Language) for pages, blog posts, attachments, comments
- `confluence_search_content` - Simple text search for pages and blog posts
- `confluence_search_generic_content` - Search for databases, whiteboards, folders, or embeds (NOT for pages/blog posts)

### Users

- `confluence_get_current_user` - Get authenticated user
- `confluence_get_user` - Get user by account ID
- `confluence_get_users` - Get all users

### Versions

- `confluence_get_page_versions` - Get page version history
- `confluence_get_page_version` - Get specific page version
- `confluence_get_blog_post_versions` - Get blog post version history
- `confluence_get_blog_post_version` - Get specific blog post version

### Content Properties

- `confluence_get_page_properties` - Get content properties for a page
- `confluence_get_page_property` - Get a specific property
- `confluence_create_page_property` - Create a property
- `confluence_update_page_property` - Update a property
- `confluence_delete_page_property` - Delete a property

### Ancestors & Descendants

- `confluence_get_page_ancestors` - Get parent pages
- `confluence_get_page_descendants` - Get all descendant pages
- `confluence_get_page_children` - Get direct children pages

### Server

- `confluence_get_server_info` - Get Confluence server info

## Available Resources

- `confluence://spaces` - List of all accessible spaces
- `confluence://myself` - Current user info
- `confluence://space/{id}` - Space details
- `confluence://page/{id}` - Page details
- `confluence://blogpost/{id}` - Blog post details

## Body Formats

Confluence supports multiple body formats:

- `storage` - XHTML-based storage format (default for read/write)
- `atlas_doc_format` - Atlassian Document Format (ADF)
- `view` - Rendered HTML (read-only)

When creating or updating content, use the storage format:

```html
<p>This is a paragraph.</p>
<h1>This is a heading</h1>
<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>
```

## CQL Search Examples

The `confluence_cql_search` tool uses Confluence Query Language (CQL):

```
# Search by content type
type=page AND space=DEV

# Full-text search
text~"search term"

# Search by creator
creator=currentUser()

# Search by date
created>=now("-7d")

# Combined search
type=page AND space=DEV AND text~"api" AND created>=now("-30d")
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run with inspector
npm run inspector
```

## Self-Healing Agents

This repository includes AI agents for automated maintenance in `scripts/agents/`:

- **BugFixAgent**: Reads bug issues, validates them, implements fixes, and creates PRs
- **PRReviewAgent**: Reviews pull requests, identifies issues, and suggests improvements

### Running Agents

```bash
cd scripts/agents
npm install

# Run bug fix agent
GITHUB_TOKEN=xxx ISSUE_NUMBER=123 npm run bug-fix

# Run PR review agent
GITHUB_TOKEN=xxx PR_NUMBER=123 PR_DIFF_FILE=diff.txt npm run pr-review
```

### Supported AI Providers

The agents support multiple AI providers with automatic fallback:

- Google AI (Gemini)
- OpenAI (GPT-4)
- Anthropic (Claude)
- Groq
- Mistral
- Perplexity
- DeepSeek
- OpenRouter

Set at least one API key:

```bash
GOOGLE_API_KEY=xxx
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
# etc.
```

## License

MIT
