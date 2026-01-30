import { ConfluenceClient } from "../auth/confluence-client.js";
import {
  getToolFilterConfig,
  ToolCategory,
  ToolFilterConfig,
} from "../config.js";

// Import all tool definitions and handlers
import { pageTools, handlePageTool } from "./pages.js";
import { spaceTools, handleSpaceTool } from "./spaces.js";
import { blogPostTools, handleBlogPostTool } from "./blog-posts.js";
import { commentTools, handleCommentTool } from "./comments.js";
import { attachmentTools, handleAttachmentTool } from "./attachments.js";
import { labelTools, handleLabelTool } from "./labels.js";
import { searchTools, handleSearchTool } from "./search.js";
import { userTools, handleUserTool } from "./users.js";
import { versionTools, handleVersionTool } from "./versions.js";
import { contentPropertyTools, handleContentPropertyTool } from "./content-properties.js";
import { ancestorTools, handleAncestorTool } from "./ancestors.js";
import { descendantTools, handleDescendantTool } from "./descendants.js";
import { serverTools, handleServerTool } from "./server.js";

// Tool type definition
interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
}

// Map category names to their tools
const toolsByCategory: Record<ToolCategory, Tool[]> = {
  page: pageTools,
  space: spaceTools,
  blogPost: blogPostTools,
  comment: commentTools,
  attachment: attachmentTools,
  label: labelTools,
  search: searchTools,
  user: userTools,
  version: versionTools,
  contentProperty: contentPropertyTools,
  ancestor: ancestorTools,
  descendant: descendantTools,
  server: serverTools,
};

// Export all tools as a single array (unfiltered)
export const allTools: Tool[] = Object.values(toolsByCategory).flat();

// Map of tool names to their categories for routing
const toolCategories: Record<string, ToolCategory> = {};

// Populate tool categories
for (const [category, tools] of Object.entries(toolsByCategory)) {
  for (const tool of tools) {
    toolCategories[tool.name] = category as ToolCategory;
  }
}

/**
 * Get filtered tools based on environment configuration
 *
 * Filtering rules:
 * 1. If CONFLUENCE_ENABLED_CATEGORIES is set, only include tools from those categories
 * 2. Remove any tools listed in CONFLUENCE_DISABLED_TOOLS
 */
export function getFilteredTools(filterConfig?: ToolFilterConfig): Tool[] {
  const config = filterConfig ?? getToolFilterConfig();

  let tools = allTools;

  // Filter by enabled categories (if specified)
  if (config.enabledCategories.length > 0) {
    const enabledSet = new Set(config.enabledCategories);
    tools = tools.filter((tool) => {
      const category = toolCategories[tool.name];
      return category && enabledSet.has(category);
    });
  }

  // Remove disabled tools
  if (config.disabledTools.length > 0) {
    const disabledSet = new Set(config.disabledTools);
    tools = tools.filter((tool) => !disabledSet.has(tool.name));
  }

  return tools;
}

/**
 * Check if a tool is enabled based on the filter configuration
 */
export function isToolEnabled(
  toolName: string,
  filterConfig?: ToolFilterConfig
): boolean {
  const config = filterConfig ?? getToolFilterConfig();

  // Check if tool is explicitly disabled
  if (config.disabledTools.includes(toolName)) {
    return false;
  }

  // Check if category filtering is enabled
  if (config.enabledCategories.length > 0) {
    const category = toolCategories[toolName];
    if (!category || !config.enabledCategories.includes(category)) {
      return false;
    }
  }

  return true;
}

// Main tool handler that routes to the appropriate category handler
export async function handleTool(
  client: ConfluenceClient,
  toolName: string,
  args: unknown,
  filterConfig?: ToolFilterConfig
): Promise<unknown> {
  const category = toolCategories[toolName];

  if (!category) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Check if tool is enabled
  if (!isToolEnabled(toolName, filterConfig)) {
    throw new Error(`Tool "${toolName}" is disabled`);
  }

  switch (category) {
    case "page":
      return handlePageTool(client, toolName, args);
    case "space":
      return handleSpaceTool(client, toolName, args);
    case "blogPost":
      return handleBlogPostTool(client, toolName, args);
    case "comment":
      return handleCommentTool(client, toolName, args);
    case "attachment":
      return handleAttachmentTool(client, toolName, args);
    case "label":
      return handleLabelTool(client, toolName, args);
    case "search":
      return handleSearchTool(client, toolName, args);
    case "user":
      return handleUserTool(client, toolName, args);
    case "version":
      return handleVersionTool(client, toolName, args);
    case "contentProperty":
      return handleContentPropertyTool(client, toolName, args);
    case "ancestor":
      return handleAncestorTool(client, toolName, args);
    case "descendant":
      return handleDescendantTool(client, toolName, args);
    case "server":
      return handleServerTool(client, toolName, args);
    default:
      throw new Error(`Unknown tool category: ${category}`);
  }
}
