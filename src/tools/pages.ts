import { z } from "zod";
import { ConfluenceClient } from "../auth/confluence-client.js";
import {
  ConfluencePage,
  ConfluencePageSingle,
  MultiEntityResult,
} from "../types/confluence.js";

// Tool definitions for pages

export const pageTools = [
  {
    name: "confluence_get_pages",
    description:
      "Get all pages. Returns pages filtered by various parameters. Results are paginated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spaceId: {
          type: "array",
          items: { type: "number" },
          description: "Filter by space IDs",
        },
        status: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by status (current, trashed, deleted, historical, draft)",
        },
        title: {
          type: "string",
          description: "Filter by exact title match",
        },
        bodyFormat: {
          type: "string",
          enum: ["storage", "atlas_doc_format", "view"],
          description: "The format of the body content to return",
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
      required: [],
    },
  },
  {
    name: "confluence_get_page",
    description:
      "Get a specific page by ID. Returns detailed page information including body content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "number",
          description: "The ID of the page",
        },
        bodyFormat: {
          type: "string",
          enum: ["storage", "atlas_doc_format", "view"],
          description: "The format of the body content to return",
        },
        getDraft: {
          type: "boolean",
          description: "If true, returns the draft version if available",
        },
        version: {
          type: "number",
          description: "Specific version number to retrieve",
        },
        includeLabels: {
          type: "boolean",
          description: "Include labels in the response",
        },
        includeProperties: {
          type: "boolean",
          description: "Include content properties in the response",
        },
        includeVersions: {
          type: "boolean",
          description: "Include version history in the response",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "confluence_create_page",
    description:
      "Create a new page in a space. Requires space ID, title, and body content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spaceId: {
          type: "string",
          description: "The ID of the space to create the page in",
        },
        title: {
          type: "string",
          description: "The title of the page",
        },
        body: {
          type: "string",
          description:
            "The body content (in storage format: XHTML-based markup)",
        },
        parentId: {
          type: "string",
          description: "The ID of the parent page (optional)",
        },
        status: {
          type: "string",
          enum: ["current", "draft"],
          description: "Page status (default: current)",
        },
      },
      required: ["spaceId", "title", "body"],
    },
  },
  {
    name: "confluence_update_page",
    description:
      "Update an existing page. Requires page ID, new title, body, and current version number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page to update",
        },
        title: {
          type: "string",
          description: "The new title of the page",
        },
        body: {
          type: "string",
          description:
            "The new body content (in storage format: XHTML-based markup)",
        },
        version: {
          type: "number",
          description:
            "The current version number (required for optimistic locking)",
        },
        status: {
          type: "string",
          enum: ["current", "draft"],
          description: "Page status",
        },
        versionMessage: {
          type: "string",
          description: "Optional message describing the changes",
        },
      },
      required: ["pageId", "title", "body", "version"],
    },
  },
  {
    name: "confluence_delete_page",
    description:
      "Delete a page. By default moves to trash; use purge=true to permanently delete.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "number",
          description: "The ID of the page to delete",
        },
        purge: {
          type: "boolean",
          description:
            "If true, permanently delete (only works on trashed pages)",
        },
        draft: {
          type: "boolean",
          description: "If true, delete a draft page",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "confluence_get_pages_in_space",
    description: "Get all pages in a specific space. Results are paginated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spaceId: {
          type: "number",
          description: "The ID of the space",
        },
        depth: {
          type: "string",
          enum: ["all", "root"],
          description:
            "Depth of pages to return (all or root level only, default: all)",
        },
        status: {
          type: "array",
          items: { type: "string" },
          description: "Filter by status (current, trashed, deleted, etc.)",
        },
        title: {
          type: "string",
          description: "Filter by exact title match",
        },
        bodyFormat: {
          type: "string",
          enum: ["storage", "atlas_doc_format", "view"],
          description: "The format of the body content to return",
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 25, max 250)",
        },
      },
      required: ["spaceId"],
    },
  },
  {
    name: "confluence_get_pages_for_label",
    description: "Get all pages with a specific label.",
    inputSchema: {
      type: "object" as const,
      properties: {
        labelId: {
          type: "number",
          description: "The ID of the label",
        },
        spaceId: {
          type: "array",
          items: { type: "number" },
          description: "Filter by space IDs",
        },
        bodyFormat: {
          type: "string",
          enum: ["storage", "atlas_doc_format", "view"],
          description: "The format of the body content to return",
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
        },
      },
      required: ["labelId"],
    },
  },
];

// Input schemas for validation
const GetPagesSchema = z.object({
  spaceId: z.array(z.number()).optional(),
  status: z.array(z.string()).optional(),
  title: z.string().optional(),
  bodyFormat: z.enum(["storage", "atlas_doc_format", "view"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

const GetPageSchema = z.object({
  pageId: z.number(),
  bodyFormat: z.enum(["storage", "atlas_doc_format", "view"]).optional(),
  getDraft: z.boolean().optional(),
  version: z.number().optional(),
  includeLabels: z.boolean().optional(),
  includeProperties: z.boolean().optional(),
  includeVersions: z.boolean().optional(),
});

const CreatePageSchema = z.object({
  spaceId: z.string(),
  title: z.string(),
  body: z.string(),
  parentId: z.string().optional(),
  status: z.enum(["current", "draft"]).optional(),
});

const UpdatePageSchema = z.object({
  pageId: z.string(),
  title: z.string(),
  body: z.string(),
  version: z.number(),
  status: z.enum(["current", "draft"]).optional(),
  versionMessage: z.string().optional(),
});

const DeletePageSchema = z.object({
  pageId: z.number(),
  purge: z.boolean().optional(),
  draft: z.boolean().optional(),
});

const GetPagesInSpaceSchema = z.object({
  spaceId: z.number(),
  depth: z.enum(["all", "root"]).optional(),
  status: z.array(z.string()).optional(),
  title: z.string().optional(),
  bodyFormat: z.enum(["storage", "atlas_doc_format", "view"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

const GetPagesForLabelSchema = z.object({
  labelId: z.number(),
  spaceId: z.array(z.number()).optional(),
  bodyFormat: z.enum(["storage", "atlas_doc_format", "view"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

// Tool handlers
export async function handlePageTool(
  client: ConfluenceClient,
  toolName: string,
  args: unknown
): Promise<unknown> {
  switch (toolName) {
    case "confluence_get_pages": {
      const input = GetPagesSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      if (input.spaceId) queryParams["space-id"] = input.spaceId.join(",");
      if (input.status) queryParams["status"] = input.status.join(",");
      if (input.title) queryParams["title"] = input.title;
      if (input.bodyFormat) queryParams["body-format"] = input.bodyFormat;
      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      return client.get<MultiEntityResult<ConfluencePage>>(
        "/pages",
        queryParams
      );
    }

    case "confluence_get_page": {
      const input = GetPageSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      if (input.bodyFormat) queryParams["body-format"] = input.bodyFormat;
      if (input.getDraft) queryParams["get-draft"] = input.getDraft;
      if (input.version) queryParams["version"] = input.version;
      if (input.includeLabels) queryParams["include-labels"] = true;
      if (input.includeProperties) queryParams["include-properties"] = true;
      if (input.includeVersions) queryParams["include-versions"] = true;

      return client.get<ConfluencePageSingle>(
        `/pages/${input.pageId}`,
        queryParams
      );
    }

    case "confluence_create_page": {
      const input = CreatePageSchema.parse(args);

      const body: Record<string, unknown> = {
        spaceId: input.spaceId,
        title: input.title,
        body: {
          representation: "storage",
          value: input.body,
        },
      };

      if (input.parentId) body.parentId = input.parentId;
      if (input.status) body.status = input.status;

      return client.post<ConfluencePageSingle>("/pages", body);
    }

    case "confluence_update_page": {
      const input = UpdatePageSchema.parse(args);

      const body: Record<string, unknown> = {
        id: input.pageId,
        status: input.status || "current",
        title: input.title,
        body: {
          representation: "storage",
          value: input.body,
        },
        version: {
          number: input.version + 1,
          message: input.versionMessage,
        },
      };

      return client.put<ConfluencePageSingle>(`/pages/${input.pageId}`, body);
    }

    case "confluence_delete_page": {
      const input = DeletePageSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      if (input.purge) queryParams["purge"] = true;
      if (input.draft) queryParams["draft"] = true;

      await client.delete(`/pages/${input.pageId}`, queryParams);
      return { success: true, deleted: input.pageId };
    }

    case "confluence_get_pages_in_space": {
      const input = GetPagesInSpaceSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      if (input.depth) queryParams["depth"] = input.depth;
      if (input.status) queryParams["status"] = input.status.join(",");
      if (input.title) queryParams["title"] = input.title;
      if (input.bodyFormat) queryParams["body-format"] = input.bodyFormat;
      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      return client.get<MultiEntityResult<ConfluencePage>>(
        `/spaces/${input.spaceId}/pages`,
        queryParams
      );
    }

    case "confluence_get_pages_for_label": {
      const input = GetPagesForLabelSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      if (input.spaceId) queryParams["space-id"] = input.spaceId.join(",");
      if (input.bodyFormat) queryParams["body-format"] = input.bodyFormat;
      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      return client.get<MultiEntityResult<ConfluencePage>>(
        `/labels/${input.labelId}/pages`,
        queryParams
      );
    }

    default:
      throw new Error(`Unknown page tool: ${toolName}`);
  }
}
