import { z } from "zod";
import { ConfluenceClient } from "../auth/confluence-client.js";
import { ConfluenceSearchResult } from "../types/confluence.js";

// Tool definitions for search

export const searchTools = [
  {
    name: "confluence_search",
    description:
      "Search Confluence content using CQL (Confluence Query Language). Returns pages, blog posts, attachments, and other content matching the query.",
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
      "Search for content (pages and blog posts) by title or content text.",
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
];

// Input schemas for validation
const SearchSchema = z.object({
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

// Tool handlers
export async function handleSearchTool(
  client: ConfluenceClient,
  toolName: string,
  args: unknown
): Promise<unknown> {
  switch (toolName) {
    case "confluence_search": {
      const input = SearchSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      queryParams["cql"] = input.cql;
      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      // Note: Search endpoint uses /wiki/rest/api/search (v1 API) as v2 doesn't have full search
      // We need to call the v1 API for search functionality
      // The client will handle this appropriately
      return client.get<ConfluenceSearchResult>("/search", queryParams);
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

      return client.get<ConfluenceSearchResult>("/search", queryParams);
    }

    default:
      throw new Error(`Unknown search tool: ${toolName}`);
  }
}
