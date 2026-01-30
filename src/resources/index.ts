import { ConfluenceClient } from "../auth/confluence-client.js";
import {
  ConfluenceSpace,
  ConfluenceSpaceSingle,
  ConfluencePageSingle,
  ConfluenceBlogPostSingle,
  ConfluenceUser,
  MultiEntityResult,
} from "../types/confluence.js";

// Resource definitions
export const resourceDefinitions = [
  {
    uri: "confluence://spaces",
    name: "Confluence Spaces",
    description: "List of all accessible Confluence spaces",
    mimeType: "application/json",
  },
  {
    uri: "confluence://myself",
    name: "Current User",
    description: "Information about the currently authenticated user",
    mimeType: "application/json",
  },
];

// Resource template definitions (for dynamic URIs)
export const resourceTemplates = [
  {
    uriTemplate: "confluence://space/{id}",
    name: "Confluence Space",
    description: "Details of a specific Confluence space by ID",
    mimeType: "application/json",
  },
  {
    uriTemplate: "confluence://page/{id}",
    name: "Confluence Page",
    description: "Details of a specific Confluence page by ID",
    mimeType: "application/json",
  },
  {
    uriTemplate: "confluence://blogpost/{id}",
    name: "Confluence Blog Post",
    description: "Details of a specific Confluence blog post by ID",
    mimeType: "application/json",
  },
];

// Resource handler
export async function handleResource(
  client: ConfluenceClient,
  uri: string
): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  // Parse the URI
  const url = new URL(uri);
  const path = url.pathname.replace(/^\/\//, "");
  const parts = path.split("/").filter(Boolean);

  let data: unknown;

  if (uri === "confluence://spaces") {
    // List all spaces
    const result = await client.get<MultiEntityResult<ConfluenceSpace>>(
      "/spaces",
      { limit: 100 }
    );
    data = result.results || [];
  } else if (uri === "confluence://myself") {
    // Get current user
    data = await client.get<ConfluenceUser>("/users/current");
  } else if (parts[0] === "space" && parts[1]) {
    // Get specific space
    data = await client.get<ConfluenceSpaceSingle>(`/spaces/${parts[1]}`);
  } else if (parts[0] === "page" && parts[1]) {
    // Get specific page
    data = await client.get<ConfluencePageSingle>(`/pages/${parts[1]}`, {
      "body-format": "storage",
    });
  } else if (parts[0] === "blogpost" && parts[1]) {
    // Get specific blog post
    data = await client.get<ConfluenceBlogPostSingle>(
      `/blogposts/${parts[1]}`,
      {
        "body-format": "storage",
      }
    );
  } else {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
