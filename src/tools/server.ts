import { ConfluenceClient } from "../auth/confluence-client.js";

// Server info types
interface ConfluenceServerInfo {
  cloudId?: string;
  baseUrl?: string;
}

// Tool definitions for server

export const serverTools = [
  {
    name: "confluence_get_server_info",
    description:
      "Get information about the Confluence server/cloud instance, including the cloud ID.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// Tool handlers
export async function handleServerTool(
  client: ConfluenceClient,
  toolName: string,
  _args: unknown
): Promise<unknown> {
  switch (toolName) {
    case "confluence_get_server_info": {
      // For Confluence Cloud, we return basic info
      // The cloudId can be obtained from the tenant_info endpoint
      // which is already handled by the client initialization
      return client.get<ConfluenceServerInfo>("/spaces", { limit: 1 }).then(() => {
        return {
          message: "Confluence Cloud instance is accessible",
          type: "cloud",
        };
      });
    }

    default:
      throw new Error(`Unknown server tool: ${toolName}`);
  }
}
