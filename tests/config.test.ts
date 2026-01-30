import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getConfig, getToolFilterConfig, ALL_CATEGORIES } from "../src/config.js";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getConfig", () => {
    it("should throw error when required env vars are missing", () => {
      delete process.env.CONFLUENCE_HOST;
      delete process.env.CONFLUENCE_EMAIL;
      delete process.env.CONFLUENCE_API_TOKEN;

      expect(() => getConfig()).toThrow("Missing required environment variables");
    });

    it("should return config when all required env vars are set", () => {
      process.env.CONFLUENCE_HOST = "https://test.atlassian.net";
      process.env.CONFLUENCE_EMAIL = "test@example.com";
      process.env.CONFLUENCE_API_TOKEN = "test-token";

      const config = getConfig();

      expect(config.host).toBe("https://test.atlassian.net");
      expect(config.email).toBe("test@example.com");
      expect(config.apiToken).toBe("test-token");
      expect(config.tokenType).toBe("classic");
    });

    it("should detect scoped token type with ATATT prefix", () => {
      process.env.CONFLUENCE_HOST = "https://test.atlassian.net";
      process.env.CONFLUENCE_EMAIL = "test@example.com";
      process.env.CONFLUENCE_API_TOKEN = "ATATT-scoped-token";

      const config = getConfig();

      expect(config.tokenType).toBe("scoped");
    });

    it("should detect scoped token type with ATSTT prefix", () => {
      process.env.CONFLUENCE_HOST = "https://test.atlassian.net";
      process.env.CONFLUENCE_EMAIL = "test@example.com";
      process.env.CONFLUENCE_API_TOKEN = "ATSTT-service-account-token";

      const config = getConfig();

      expect(config.tokenType).toBe("scoped");
    });

    it("should normalize host URL by removing trailing slashes", () => {
      process.env.CONFLUENCE_HOST = "https://test.atlassian.net///";
      process.env.CONFLUENCE_EMAIL = "test@example.com";
      process.env.CONFLUENCE_API_TOKEN = "test-token";

      const config = getConfig();

      expect(config.host).toBe("https://test.atlassian.net");
    });

    it("should include cloudId when provided", () => {
      process.env.CONFLUENCE_HOST = "https://test.atlassian.net";
      process.env.CONFLUENCE_EMAIL = "test@example.com";
      process.env.CONFLUENCE_API_TOKEN = "test-token";
      process.env.CONFLUENCE_CLOUD_ID = "test-cloud-id";

      const config = getConfig();

      expect(config.cloudId).toBe("test-cloud-id");
    });
  });

  describe("getToolFilterConfig", () => {
    it("should return empty arrays when no filtering env vars are set", () => {
      delete process.env.CONFLUENCE_ENABLED_CATEGORIES;
      delete process.env.CONFLUENCE_DISABLED_TOOLS;

      const config = getToolFilterConfig();

      expect(config.enabledCategories).toEqual([]);
      expect(config.disabledTools).toEqual([]);
    });

    it("should parse enabled categories", () => {
      process.env.CONFLUENCE_ENABLED_CATEGORIES = "page,space,search";

      const config = getToolFilterConfig();

      expect(config.enabledCategories).toEqual(["page", "space", "search"]);
    });

    it("should handle whitespace in category list", () => {
      process.env.CONFLUENCE_ENABLED_CATEGORIES = "page , space , search";

      const config = getToolFilterConfig();

      expect(config.enabledCategories).toEqual(["page", "space", "search"]);
    });

    it("should filter out invalid categories", () => {
      process.env.CONFLUENCE_ENABLED_CATEGORIES = "page,invalid,space";

      const config = getToolFilterConfig();

      expect(config.enabledCategories).toEqual(["page", "space"]);
    });

    it("should parse disabled tools", () => {
      process.env.CONFLUENCE_DISABLED_TOOLS =
        "confluence_delete_page,confluence_delete_space";

      const config = getToolFilterConfig();

      expect(config.disabledTools).toEqual([
        "confluence_delete_page",
        "confluence_delete_space",
      ]);
    });
  });

  describe("ALL_CATEGORIES", () => {
    it("should contain all expected categories", () => {
      expect(ALL_CATEGORIES).toContain("page");
      expect(ALL_CATEGORIES).toContain("space");
      expect(ALL_CATEGORIES).toContain("blogPost");
      expect(ALL_CATEGORIES).toContain("comment");
      expect(ALL_CATEGORIES).toContain("attachment");
      expect(ALL_CATEGORIES).toContain("label");
      expect(ALL_CATEGORIES).toContain("search");
      expect(ALL_CATEGORIES).toContain("user");
      expect(ALL_CATEGORIES).toContain("server");
    });
  });
});
