import { tool } from 'ai';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { getConfig } from '../config.js';

/**
 * GitHub tools for interacting with the GitHub API
 */
export function createGitHubTools(repoOwner: string, repoName: string) {
  const config = getConfig();
  const octokit = new Octokit({ auth: config.githubToken });

  return {
    /**
     * Get issues from the repository
     */
    getIssues: tool({
      description: 'Get issues from the repository',
      inputSchema: z.object({
        labels: z.array(z.string()).optional().describe('Filter by labels'),
        state: z.enum(['open', 'closed', 'all']).default('open').describe('Issue state'),
        limit: z.number().default(10).describe('Maximum number of issues'),
      }),
      execute: async ({ labels, state, limit }: { labels?: string[]; state: 'open' | 'closed' | 'all'; limit: number }) => {
        try {
          const { data } = await octokit.issues.listForRepo({
            owner: repoOwner,
            repo: repoName,
            labels: labels?.join(','),
            state,
            per_page: limit,
          });

          const issues = data
            .filter((issue) => !issue.pull_request) // Exclude PRs
            .map((issue) => ({
              number: issue.number,
              title: issue.title,
              body: issue.body,
              state: issue.state,
              labels: issue.labels.map((l) =>
                typeof l === 'string' ? l : l.name
              ),
              createdAt: issue.created_at,
              author: issue.user?.login,
            }));

          return { success: true, issues, count: issues.length };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get issues: ${error instanceof Error ? error.message : 'Unknown error'}`,
            issues: [],
          };
        }
      },
    }),

    /**
     * Get a specific issue
     */
    getIssue: tool({
      description: 'Get details of a specific issue',
      inputSchema: z.object({
        issueNumber: z.number().describe('Issue number'),
      }),
      execute: async ({ issueNumber }: { issueNumber: number }) => {
        try {
          const { data } = await octokit.issues.get({
            owner: repoOwner,
            repo: repoName,
            issue_number: issueNumber,
          });

          return {
            success: true,
            issue: {
              number: data.number,
              title: data.title,
              body: data.body,
              state: data.state,
              labels: data.labels.map((l) =>
                typeof l === 'string' ? l : l.name
              ),
              createdAt: data.created_at,
              author: data.user?.login,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Create a comment on an issue
     */
    commentOnIssue: tool({
      description: 'Add a comment to an issue',
      inputSchema: z.object({
        issueNumber: z.number().describe('Issue number'),
        body: z.string().describe('Comment body'),
      }),
      execute: async ({ issueNumber, body }: { issueNumber: number; body: string }) => {
        try {
          const { data } = await octokit.issues.createComment({
            owner: repoOwner,
            repo: repoName,
            issue_number: issueNumber,
            body,
          });

          return {
            success: true,
            commentId: data.id,
            url: data.html_url,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to create comment: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Create a pull request
     */
    createPullRequest: tool({
      description: 'Create a new pull request',
      inputSchema: z.object({
        title: z.string().describe('PR title'),
        body: z.string().describe('PR body/description'),
        head: z.string().describe('Branch containing changes'),
        base: z.string().default('main').describe('Base branch'),
      }),
      execute: async ({ title, body, head, base }: { title: string; body: string; head: string; base: string }) => {
        try {
          const { data } = await octokit.pulls.create({
            owner: repoOwner,
            repo: repoName,
            title,
            body,
            head,
            base,
          });

          return {
            success: true,
            prNumber: data.number,
            url: data.html_url,
            title: data.title,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Create a review on a pull request
     */
    createReview: tool({
      description: 'Submit a review on a pull request with optional inline comments',
      inputSchema: z.object({
        prNumber: z.number().describe('PR number'),
        body: z.string().describe('Review summary'),
        event: z
          .enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT'])
          .describe('Review action'),
        comments: z.array(z.object({
          path: z.string().describe('File path'),
          line: z.number().describe('Line number in the diff to comment on'),
          body: z.string().describe('Comment text'),
        })).optional().describe('Optional inline comments on specific lines of code'),
      }),
      execute: async ({ prNumber, body, event, comments }: {
        prNumber: number;
        body: string;
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
        comments?: Array<{ path: string; line: number; body: string }>;
      }) => {
        try {
          const { data } = await octokit.pulls.createReview({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
            body,
            event,
            comments: comments?.map(c => ({
              path: c.path,
              line: c.line,
              body: c.body,
            })),
          });

          return {
            success: true,
            reviewId: data.id,
            state: data.state,
            commentsCount: comments?.length || 0,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to create review: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Get file contents from repository
     */
    getFileContents: tool({
      description: 'Get the contents of a file from the repository via GitHub API',
      inputSchema: z.object({
        path: z.string().describe('Path to the file in the repository'),
        ref: z.string().optional().describe('Branch, tag, or commit SHA'),
      }),
      execute: async ({ path, ref }: { path: string; ref?: string }) => {
        try {
          const { data } = await octokit.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path,
            ref,
          });

          if (!('content' in data) || Array.isArray(data)) {
            return {
              success: false,
              error: `Path ${path} is not a file`,
              path,
            };
          }

          const content = Buffer.from(data.content, 'base64').toString('utf-8');

          return {
            success: true,
            content,
            path,
            sha: data.sha,
            size: data.size,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get file contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path,
          };
        }
      },
    }),
  };
}
