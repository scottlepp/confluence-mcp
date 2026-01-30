import { z } from "zod";
import { ConfluenceClient } from "../auth/confluence-client.js";
import { ConfluenceSearchResult } from "../types/confluence.js";

// Tool definitions for search

export const searchTools = [
  {
    name: "confluence_cql_search",
    description:
      "Search Confluence using CQL (Confluence Query Language). Use this for advanced searches of pages, blog posts, attachments, and comments. Supports complex queries with operators like AND, OR, text~, created>=, etc. Results are paginated - if you don't find what you need, use the returned cursor to fetch more pages until found or no more results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cql: {
          type: "string",
          description:
            'The CQL query string. Examples: "type=page AND space=DEV", "text~\\"search term\\"", "creator=currentUser() AND created>=now(\\"-7d\\")"',
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination (from previous response)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 25, max 250)",
        },
      },
      required: ["cql"],
    },
  },
  {
    name: "confluence_search_content",
    description:
      "Simple text search for pages and blog posts by title or content. For more complex searches, use confluence_cql_search instead. Results are paginated - if you don't find what you need, use the returned cursor to fetch more pages until found or no more results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search text to find in titles or content",
        },
        spaceKey: {
          type: "string",
          description: "Limit search to a specific space key",
        },
        type: {
          type: "string",
          enum: ["page", "blogpost", "attachment"],
          description: "Filter by content type",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "confluence_search_generic_content",
    description:
      "Search for generic content types: databases, whiteboards, folders, or embeds. NOT for pages or blog posts - use confluence_cql_search or confluence_search_content for those. Results are paginated - use the returned cursor to fetch more pages if needed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["DATABASES", "WHITEBOARDS", "FOLDERS", "EMBEDS"],
          description:
            "The type of generic content to search for. Must be one of: DATABASES, WHITEBOARDS, FOLDERS, EMBEDS",
        },
        spaceId: {
          type: "string",
          description: "Filter by space ID",
        },
        title: {
          type: "string",
          description: "Filter by title (partial match)",
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination (from previous response)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 25, max 250)",
        },
      },
      required: ["type"],
    },
  },
];

// Input schemas for validation
const CqlSearchSchema = z.object({
  cql: z.string(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

const SearchContentSchema = z.object({
  query: z.string(),
  spaceKey: z.string().optional(),
  type: z.enum(["page", "blogpost", "attachment"]).optional(),
  limit: z.number().optional(),
});

const SearchGenericContentSchema = z.object({
  type: z.enum(["DATABASES", "WHITEBOARDS", "FOLDERS", "EMBEDS"]),
  spaceId: z.string().optional(),
  title: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

// Tool handlers
export async function handleSearchTool(
  client: ConfluenceClient,
  toolName: string,
  args: unknown
): Promise<unknown> {
  switch (toolName) {
    case "confluence_cql_search": {
      const input = CqlSearchSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      queryParams["cql"] = input.cql;
      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      // CQL search uses v1 API (/wiki/rest/api/search) as v2 doesn't have CQL search
      return client.getV1<ConfluenceSearchResult>("/search", queryParams);
    }

    case "confluence_search_content": {
      const input = SearchContentSchema.parse(args);

      // Build CQL query from parameters
      const cqlParts: string[] = [];

      // Text search
      cqlParts.push(`text~"${input.query.replace(/"/g, '\\"')}"`);

      // Space filter
      if (input.spaceKey) {
        cqlParts.push(`space="${input.spaceKey}"`);
      }

      // Type filter
      if (input.type) {
        cqlParts.push(`type=${input.type}`);
      }

      const cql = cqlParts.join(" AND ");
      const queryParams: Record<string, string | number | boolean | undefined> =
        {
          cql,
        };

      if (input.limit) queryParams["limit"] = input.limit;

      // Content search uses v1 API (/wiki/rest/api/search) with CQL
      return client.getV1<ConfluenceSearchResult>("/search", queryParams);
    }

    case "confluence_search_generic_content": {
      const input = SearchGenericContentSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      queryParams["type"] = input.type;
      if (input.spaceId) queryParams["space-id"] = input.spaceId;
      if (input.title) queryParams["title"] = input.title;
      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      // Generic content search uses v2 API /search endpoint
      return client.get<unknown>("/search", queryParams);
    }

    default:
      throw new Error(`Unknown search tool: ${toolName}`);
  }
}
