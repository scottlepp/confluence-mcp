// Common types

export interface ConfluenceUser {
  type?: string;
  accountId: string;
  accountType?: string;
  email?: string;
  publicName?: string;
  displayName?: string;
  profilePicture?: {
    path: string;
    width: number;
    height: number;
    isDefault: boolean;
  };
}

export interface ConfluenceVersion {
  createdAt: string;
  message?: string;
  number: number;
  minorEdit: boolean;
  authorId: string;
}

export interface ConfluenceBody {
  storage?: {
    value: string;
    representation: string;
  };
  atlas_doc_format?: {
    value: string;
    representation: string;
  };
  view?: {
    value: string;
    representation: string;
  };
}

export interface ConfluenceLinks {
  webui?: string;
  editui?: string;
  tinyui?: string;
  self?: string;
  base?: string;
  next?: string;
}

// Page types

export interface ConfluencePage {
  id: string;
  status: "current" | "trashed" | "deleted" | "historical" | "draft";
  title: string;
  spaceId: string;
  parentId?: string;
  parentType?: "page" | "whiteboard" | "database" | "folder";
  position?: number;
  authorId: string;
  ownerId?: string;
  lastOwnerId?: string;
  createdAt: string;
  version: ConfluenceVersion;
  body?: ConfluenceBody;
  _links?: ConfluenceLinks;
}

export interface ConfluencePageSingle extends ConfluencePage {
  labels?: {
    results: ConfluenceLabel[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  properties?: {
    results: ConfluenceContentProperty[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  operations?: {
    results: Array<{ operation: string; targetType: string }>;
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  likes?: {
    results: Array<{ accountId: string }>;
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  versions?: {
    results: ConfluenceVersion[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  isFavoritedByCurrentUser?: boolean;
}

// Space types

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: "global" | "personal";
  status: "current" | "archived";
  authorId?: string;
  createdAt?: string;
  homepageId?: string;
  description?: {
    plain?: { value: string; representation: string };
    view?: { value: string; representation: string };
  };
  icon?: {
    path: string;
    apiDownloadLink?: string;
  };
  _links?: ConfluenceLinks;
}

export interface ConfluenceSpaceSingle extends ConfluenceSpace {
  labels?: {
    results: ConfluenceLabel[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  properties?: {
    results: ConfluenceSpaceProperty[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  operations?: {
    results: Array<{ operation: string; targetType: string }>;
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
}

// Blog Post types

export interface ConfluenceBlogPost {
  id: string;
  status: "current" | "trashed" | "deleted" | "historical" | "draft";
  title: string;
  spaceId: string;
  authorId: string;
  createdAt: string;
  version: ConfluenceVersion;
  body?: ConfluenceBody;
  _links?: ConfluenceLinks;
}

export interface ConfluenceBlogPostSingle extends ConfluenceBlogPost {
  labels?: {
    results: ConfluenceLabel[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  properties?: {
    results: ConfluenceContentProperty[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  operations?: {
    results: Array<{ operation: string; targetType: string }>;
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  likes?: {
    results: Array<{ accountId: string }>;
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
  versions?: {
    results: ConfluenceVersion[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
}

// Comment types

export interface ConfluenceComment {
  id: string;
  status: "current" | "deleted";
  title?: string;
  blogPostId?: string;
  pageId?: string;
  parentCommentId?: string;
  version: ConfluenceVersion;
  body?: ConfluenceBody;
  _links?: ConfluenceLinks;
}

export interface ConfluenceFooterComment extends ConfluenceComment {
  // Footer comments are at the bottom of a page/blog post
}

export interface ConfluenceInlineComment extends ConfluenceComment {
  // Inline comments are attached to specific content within a page
  resolutionStatus?: "open" | "resolved" | "reopened";
  resolutionLastModifierId?: string;
  resolutionLastModifiedAt?: string;
  properties?: {
    results: ConfluenceContentProperty[];
    meta?: { hasMore: boolean; cursor?: string };
    _links?: { self: string };
  };
}

// Attachment types

export interface ConfluenceAttachment {
  id: string;
  status: "current" | "trashed" | "deleted" | "historical" | "draft";
  title: string;
  pageId?: string;
  blogPostId?: string;
  customContentId?: string;
  mediaType: string;
  mediaTypeDescription?: string;
  comment?: string;
  fileId?: string;
  fileSize?: number;
  webuiLink?: string;
  downloadLink?: string;
  version: ConfluenceVersion;
  _links?: ConfluenceLinks;
}

// Label types

export interface ConfluenceLabel {
  id: string;
  name: string;
  prefix?: string;
}

// Content Property types

export interface ConfluenceContentProperty {
  id: string;
  key: string;
  value?: unknown;
  version?: {
    number: number;
    message?: string;
    minorEdit: boolean;
    authorId: string;
    createdAt: string;
  };
}

export interface ConfluenceSpaceProperty {
  id: string;
  key: string;
  value?: unknown;
  version?: {
    number: number;
    message?: string;
    minorEdit: boolean;
    authorId: string;
    createdAt: string;
  };
}

// Search types

export interface ConfluenceSearchResult {
  results: Array<{
    content?: ConfluencePage | ConfluenceBlogPost | ConfluenceAttachment;
    title?: string;
    excerpt?: string;
    url?: string;
    resultGlobalContainer?: {
      title: string;
      displayUrl: string;
    };
    breadcrumbs?: Array<{
      label: string;
      url: string;
      separator: string;
    }>;
    entityType?: string;
    iconCssClass?: string;
    lastModified?: string;
    friendlyLastModified?: string;
    score?: number;
  }>;
  start: number;
  limit: number;
  size: number;
  totalSize?: number;
  cqlQuery?: string;
  searchDuration?: number;
  _links?: ConfluenceLinks;
}

// Ancestor/Descendant types

export interface ConfluenceAncestor {
  id: string;
  type: "page";
  status: string;
  title: string;
  spaceId: string;
  parentId?: string;
  parentType?: string;
  position?: number;
  authorId: string;
  ownerId?: string;
  lastOwnerId?: string;
  createdAt: string;
  _links?: ConfluenceLinks;
}

// Task types

export interface ConfluenceTask {
  id: string;
  localId: string;
  spaceId: string;
  pageId?: string;
  blogPostId?: string;
  status: "incomplete" | "complete";
  body?: ConfluenceBody;
  createdBy: string;
  assignedTo?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt?: string;
  dueAt?: string;
  completedAt?: string;
}

// Version types

export interface ConfluenceVersionDetail {
  createdAt: string;
  message?: string;
  number: number;
  minorEdit: boolean;
  authorId: string;
  pageId?: string;
  blogPostId?: string;
}

// Paginated response types

export interface PaginatedResponse<T> {
  results: T[];
  _links?: ConfluenceLinks;
}

export interface MultiEntityResult<T> {
  results: T[];
  _links?: {
    next?: string;
    base?: string;
  };
}
