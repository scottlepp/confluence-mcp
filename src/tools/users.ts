import { z } from "zod";
import { ConfluenceClient } from "../auth/confluence-client.js";
import { ConfluenceUser, MultiEntityResult } from "../types/confluence.js";

// Tool definitions for users

export const userTools = [
  {
    name: "confluence_get_current_user",
    description:
      "Get information about the currently authenticated user (the user associated with the API token).",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "confluence_get_user",
    description: "Get a specific user by account ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        accountId: {
          type: "string",
          description: "The account ID of the user",
        },
      },
      required: ["accountId"],
    },
  },
  {
    name: "confluence_get_users",
    description: "Get multiple users. Results are paginated - use the returned cursor to fetch more pages if you don't find what you need.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cursor: {
          type: "string",
          description: "Cursor for pagination",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
        },
      },
      required: [],
    },
  },
];

// Input schemas for validation
const GetUserSchema = z.object({
  accountId: z.string(),
});

const GetUsersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

// Tool handlers
export async function handleUserTool(
  client: ConfluenceClient,
  toolName: string,
  args: unknown
): Promise<unknown> {
  switch (toolName) {
    case "confluence_get_current_user": {
      return client.get<ConfluenceUser>("/users/current");
    }

    case "confluence_get_user": {
      const input = GetUserSchema.parse(args);
      return client.get<ConfluenceUser>(`/users/${input.accountId}`);
    }

    case "confluence_get_users": {
      const input = GetUsersSchema.parse(args);
      const queryParams: Record<string, string | number | boolean | undefined> =
        {};

      if (input.cursor) queryParams["cursor"] = input.cursor;
      if (input.limit) queryParams["limit"] = input.limit;

      return client.get<MultiEntityResult<ConfluenceUser>>("/users", queryParams);
    }

    default:
      throw new Error(`Unknown user tool: ${toolName}`);
  }
}
