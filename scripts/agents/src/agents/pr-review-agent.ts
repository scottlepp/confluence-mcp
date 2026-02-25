import { generateText, ToolSet } from 'ai';
import { BaseAgent } from './base-agent.js';
import {
  AgentContext,
  AgentResult,
  PRReviewAgentInput,
  PRReviewAgentOutput,
  ReviewIssue,
  ReviewSuggestion,
  ValidationResult,
} from './types.js';
import { createGitHubTools } from '../tools/github-tools.js';
import { getConfig } from '../config.js';

/** File patterns to exclude from review diffs (noise / not useful for code review) */
const EXCLUDED_FILE_PATTERNS = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
];

/** Represents a single file's diff section */
interface FileDiff {
  filePath: string;
  diff: string;
}

/**
 * Filter a unified diff string to remove files matching excluded patterns
 * and split into per-file sections.
 */
function prepareDiff(raw: string): { files: FileDiff[]; filtered: string[] } {
  const filtered: string[] = [];
  const files: FileDiff[] = [];
  // Split on "diff --git" boundaries while keeping the delimiter
  const fileDiffs = raw.split(/(?=^diff --git )/m);

  for (const section of fileDiffs) {
    if (!section.trim()) continue;
    const nameMatch = section.match(/^diff --git a\/(.+?) b\//);
    const filePath = nameMatch?.[1] ?? 'unknown';

    const shouldExclude = EXCLUDED_FILE_PATTERNS.some((p) => section.includes(p));
    if (shouldExclude) {
      filtered.push(filePath);
      continue;
    }
    files.push({ filePath, diff: section });
  }

  return { files, filtered };
}

/** Comment produced by a per-file chunk review */
interface ChunkComment {
  path: string;
  line: number;
  body: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

/**
 * PR Review Agent - Reviews pull requests and suggests improvements.
 *
 * Supports two modes:
 *  - **normal**: sends the whole diff in one LLM call (needs a model with large context).
 *  - **chunked**: reviews each file separately, then submits a combined review.
 *    This works even with very small token limits (e.g. GitHub Models free tier 8 K).
 */
export class PRReviewAgent extends BaseAgent<PRReviewAgentInput, PRReviewAgentOutput> {
  readonly name = 'pr-review-agent';
  readonly description = 'Reviews pull requests, identifies issues, and suggests improvements';

  async validate(
    input: PRReviewAgentInput,
    context: AgentContext
  ): Promise<ValidationResult> {
    const baseResult = await super.validate(input, context);
    const errors = [...baseResult.errors];
    const warnings = [...baseResult.warnings];

    if (!input.prNumber) {
      errors.push('PR number is required');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getTools(context: AgentContext): ToolSet {
    const githubTools = createGitHubTools(context.repoOwner, context.repoName);

    return {
      createReview: githubTools.createReview,
    };
  }

  getSystemPrompt(input: PRReviewAgentInput, context: AgentContext): string {
    const focusAreasStr = input.focusAreas?.join(', ') || 'all areas';

    return `You are a code review AI agent. Your job is to review pull requests, provide helpful feedback, and ensure code quality.

You have been provided with the complete PR diff showing all changes.

Your workflow:
1. Review the diff to understand what changed
2. Analyze code for issues in: ${focusAreasStr}
3. ${input.suggestTests ? 'Suggest test files for untested code' : 'Note any missing tests'}
4. Submit a review using createReview WITH inline comments

IMPORTANT: The diff has been provided for you. You do NOT need to call any tools to read files.
Just analyze the diff and submit your review using the createReview tool.

INLINE COMMENTS:
When you find specific issues in the code, create inline comments using the comments array in createReview:
- Use the line number from the DIFF (not the absolute file line number)
- Each comment should reference a specific line in a specific file
- Be specific about what's wrong and how to fix it

REVIEW GUIDELINES:
- Be constructive, not harsh
- Explain WHY something is an issue
- Provide concrete suggestions for fixes
- Prioritize issues by severity
- Consider the context and purpose of the changes
- Acknowledge good patterns and improvements
- Leave inline comments for specific code issues

REVIEW DECISION (IMPORTANT):
You MUST choose the appropriate review action:
- APPROVE: Use when the code is good to merge. Minor suggestions (low/info severity) should NOT block approval.
  When approving, set enableAutoMerge: true to automatically merge the PR once all checks pass.
- REQUEST_CHANGES: Use when there are critical or high severity issues that MUST be fixed before merging.
- COMMENT: Use ONLY when you're unsure or need more information.

Default to APPROVE (with enableAutoMerge: true) if there are no critical/high issues. Be pragmatic - don't block PRs for minor style preferences.

SEVERITY LEVELS:
- critical: Security vulnerabilities, data loss risks, breaking changes → REQUEST_CHANGES
- high: Bugs, significant performance issues, logic errors → REQUEST_CHANGES
- medium: Code quality issues, missing error handling → APPROVE with suggestions
- low: Style issues, minor improvements → APPROVE with suggestions
- info: Suggestions, nice-to-haves → APPROVE with suggestions

WHAT TO LOOK FOR:
- Security vulnerabilities (injection, XSS, auth issues)
- Logic errors and edge cases
- Missing error handling
- Performance issues
- Test coverage gaps
- Code style and consistency
- Documentation gaps

Working directory: ${context.workingDir}
Repository: ${context.repoOwner}/${context.repoName}`;
  }

  getUserPrompt(input: PRReviewAgentInput, context: AgentContext): string {
    const { files, filtered } = prepareDiff(input.diff || '');
    const diff = files.map((f) => f.diff).join('');

    const notes: string[] = [];
    if (filtered.length > 0) {
      notes.push(`Note: The following files were excluded from the diff (lock files): ${filtered.join(', ')}`);
    }

    return `Review PR #${input.prNumber} in repository ${context.repoOwner}/${context.repoName}.

Focus areas: ${input.focusAreas?.join(', ') || 'all areas'}
Suggest tests: ${input.suggestTests !== false ? 'yes' : 'no'}
${notes.length > 0 ? '\n' + notes.join('\n') + '\n' : ''}
PR Diff:
\`\`\`diff
${diff || 'No diff provided'}
\`\`\`

---

Instructions:
1. Analyze each file's changes
2. ${input.suggestTests !== false ? 'Suggest test files based on the changed files' : 'Note any missing test coverage'}
3. For EACH specific issue you find, note the file path and line number
4. Use createReview to submit your review with inline comments`;
  }

  // ── Chunked review helpers ──────────────────────────────────────────

  private getChunkSystemPrompt(focusAreas: string[]): string {
    const focusAreasStr = focusAreas.join(', ') || 'all areas';
    return `You are a code review AI. Review the provided file diff and return ONLY a JSON object (no markdown fences, no extra text).

Focus areas: ${focusAreasStr}

Return JSON in exactly this format:
{
  "comments": [
    {
      "line": <diff line number>,
      "body": "<review comment>",
      "severity": "critical" | "high" | "medium" | "low" | "info"
    }
  ],
  "suggestedTests": ["<test file suggestion>"],
  "summary": "<one sentence summary of this file's changes>"
}

If there are no issues, return: { "comments": [], "suggestedTests": [], "summary": "<summary>" }

SEVERITY GUIDE:
- critical/high: security vulnerabilities, bugs, data loss, breaking changes
- medium: missing error handling, code quality issues
- low/info: style, minor improvements, nice-to-haves`;
  }

  private getChunkUserPrompt(fileDiff: FileDiff): string {
    return `Review this file diff for ${fileDiff.filePath}:

\`\`\`diff
${fileDiff.diff}
\`\`\``;
  }

  /**
   * Review a single file diff and return structured comments.
   */
  private async reviewFileChunk(
    fileDiff: FileDiff,
    focusAreas: string[]
  ): Promise<{ comments: ChunkComment[]; suggestedTests: string[]; summary: string }> {
    try {
      const { text } = await generateText({
        model: this.model,
        system: this.getChunkSystemPrompt(focusAreas),
        prompt: this.getChunkUserPrompt(fileDiff),
      });

      // Parse JSON from the response (strip markdown fences if present)
      const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      const comments: ChunkComment[] = (parsed.comments || []).map(
        (c: { line: number; body: string; severity?: string }) => ({
          path: fileDiff.filePath,
          line: c.line,
          body: c.body,
          severity: c.severity || 'info',
        })
      );

      return {
        comments,
        suggestedTests: parsed.suggestedTests || [],
        summary: parsed.summary || '',
      };
    } catch (error) {
      this.log('warn', `Chunk review failed for ${fileDiff.filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { comments: [], suggestedTests: [], summary: `Failed to review ${fileDiff.filePath}` };
    }
  }

  /**
   * Chunked review: review each file separately, then submit one combined GitHub review.
   */
  private async executeChunkedReview(
    input: PRReviewAgentInput,
    context: AgentContext
  ): Promise<AgentResult<PRReviewAgentOutput>> {
    const { files, filtered } = prepareDiff(input.diff || '');
    const focusAreas = input.focusAreas || ['security', 'logic', 'tests'];

    this.log('info', `Chunked review: ${files.length} files to review, ${filtered.length} excluded`);

    // Review each file
    const allComments: ChunkComment[] = [];
    const allSuggestedTests: string[] = [];
    const fileSummaries: string[] = [];

    for (const fileDiff of files) {
      this.log('info', `Reviewing chunk: ${fileDiff.filePath}`);
      const result = await this.reviewFileChunk(fileDiff, focusAreas);
      allComments.push(...result.comments);
      allSuggestedTests.push(...result.suggestedTests);
      if (result.summary) {
        fileSummaries.push(`- **${fileDiff.filePath}**: ${result.summary}`);
      }
    }

    // Determine approval based on severities
    const hasCriticalOrHigh = allComments.some(
      (c) => c.severity === 'critical' || c.severity === 'high'
    );
    const approval: PRReviewAgentOutput['approval'] = hasCriticalOrHigh
      ? 'request_changes'
      : 'approve';
    const event = hasCriticalOrHigh ? 'REQUEST_CHANGES' : 'APPROVE';

    // Build review body
    const bodyParts: string[] = ['## AI Code Review\n'];
    if (filtered.length > 0) {
      bodyParts.push(`*Excluded lock files: ${filtered.join(', ')}*\n`);
    }
    if (fileSummaries.length > 0) {
      bodyParts.push('### File Summaries\n' + fileSummaries.join('\n') + '\n');
    }
    if (allSuggestedTests.length > 0) {
      const unique = [...new Set(allSuggestedTests)];
      bodyParts.push('### Suggested Tests\n' + unique.map((t) => `- ${t}`).join('\n') + '\n');
    }
    const critCount = allComments.filter((c) => c.severity === 'critical').length;
    const highCount = allComments.filter((c) => c.severity === 'high').length;
    const medCount = allComments.filter((c) => c.severity === 'medium').length;
    const lowCount = allComments.filter((c) => c.severity === 'low' || c.severity === 'info').length;
    if (allComments.length > 0) {
      bodyParts.push(`### Issues: ${allComments.length} total`);
      if (critCount) bodyParts.push(`- ${critCount} critical`);
      if (highCount) bodyParts.push(`- ${highCount} high`);
      if (medCount) bodyParts.push(`- ${medCount} medium`);
      if (lowCount) bodyParts.push(`- ${lowCount} low/info`);
    } else {
      bodyParts.push('No significant issues found.');
    }
    bodyParts.push(`\n**Recommendation:** ${event === 'APPROVE' ? 'Approve' : 'Request changes'}`);

    const reviewBody = bodyParts.join('\n');

    // Submit combined review via GitHub API
    const githubTools = createGitHubTools(context.repoOwner, context.repoName);
    const reviewComments = allComments.map((c) => ({
      path: c.path,
      line: c.line,
      body: `**[${c.severity.toUpperCase()}]** ${c.body}`,
    }));

    const executeFn = githubTools.createReview.execute;
    if (!executeFn) {
      throw new Error('createReview tool has no execute function');
    }
    const reviewResult = await executeFn(
      {
        prNumber: input.prNumber,
        body: reviewBody,
        event,
        comments: reviewComments.length > 0 ? reviewComments : undefined,
        enableAutoMerge: event === 'APPROVE',
      },
      { toolCallId: '', messages: [], abortSignal: undefined }
    );

    this.log('info', 'Chunked review submitted', { reviewResult });

    // Map to output
    const issues: ReviewIssue[] = allComments.map((c) => ({
      severity: c.severity,
      category: 'code-review',
      file: c.path,
      line: c.line,
      message: c.body,
    }));

    return {
      success: true,
      data: {
        summary: reviewBody,
        issues,
        suggestions: [],
        suggestedTests: [...new Set(allSuggestedTests)],
        approval,
      },
      proposedChanges: [],
      validated: true,
    };
  }

  // ── Main execute ────────────────────────────────────────────────────

  async execute(
    input: PRReviewAgentInput,
    context: AgentContext
  ): Promise<AgentResult<PRReviewAgentOutput>> {
    // Validate input
    const validation = await this.validate(input, context);
    if (!validation.valid) {
      return this.errorResult('VALIDATION_ERROR', validation.errors.join(', '), true);
    }

    if (!input.prNumber) {
      return this.errorResult('MISSING_PR', 'PR number is required', true);
    }

    // Add PR number to context
    const reviewContext: AgentContext = {
      ...context,
      prNumber: input.prNumber,
    };

    this.log('info', 'Starting PR review', {
      prNumber: input.prNumber,
      chunkedReview: input.chunkedReview ?? false,
      focusAreas: input.focusAreas,
    });

    try {
      // Use chunked review when requested
      if (input.chunkedReview) {
        return await this.executeChunkedReview(input, reviewContext);
      }

      // Normal full-diff review
      const { text, proposedChanges, toolCalls } = await this.runAgentLoop(
        input,
        reviewContext
      );

      // Extract results from the review
      const issues: ReviewIssue[] = [];
      const suggestions: ReviewSuggestion[] = [];
      const suggestedTests: string[] = [];
      let approval: PRReviewAgentOutput['approval'] = 'comment';

      // Check for review submission
      for (const call of toolCalls) {
        if (call.name === 'createReview') {
          const args = call.args as { event?: string };
          if (args.event === 'APPROVE') {
            approval = 'approve';
          } else if (args.event === 'REQUEST_CHANGES') {
            approval = 'request_changes';
          }
        }
      }

      // Generate summary
      const summary = this.generateSummary(issues, suggestedTests, approval);

      return {
        success: true,
        data: {
          summary,
          issues,
          suggestions,
          suggestedTests,
          approval,
        },
        proposedChanges,
        validated: true,
        warnings: validation.warnings,
      };
    } catch (error) {
      this.log('error', 'PR review failed', { error });
      return this.errorResult(
        'REVIEW_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
        false
      );
    }
  }

  private generateSummary(
    issues: ReviewIssue[],
    suggestedTests: string[],
    approval: PRReviewAgentOutput['approval']
  ): string {
    const parts: string[] = [];

    if (issues.length === 0) {
      parts.push('No significant issues found in this PR.');
    } else {
      const critical = issues.filter((i) => i.severity === 'critical').length;
      const high = issues.filter((i) => i.severity === 'high').length;
      const medium = issues.filter((i) => i.severity === 'medium').length;
      const low = issues.filter((i) => i.severity === 'low').length;

      parts.push(`Found ${issues.length} issue(s):`);
      if (critical > 0) parts.push(`- ${critical} critical`);
      if (high > 0) parts.push(`- ${high} high`);
      if (medium > 0) parts.push(`- ${medium} medium`);
      if (low > 0) parts.push(`- ${low} low`);
    }

    if (suggestedTests.length > 0) {
      parts.push(`\nTest coverage: ${suggestedTests.length} file(s) need tests.`);
    }

    parts.push(
      `\nRecommendation: ${approval === 'approve' ? 'Approve' : approval === 'request_changes' ? 'Request changes' : 'Comment only'}`
    );

    return parts.join('\n');
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();

  const prNumber = process.env.PR_NUMBER
    ? parseInt(process.env.PR_NUMBER, 10)
    : undefined;

  if (!prNumber) {
    console.error('PR_NUMBER environment variable is required');
    process.exit(1);
  }

  const prDiffFile = process.env.PR_DIFF_FILE;

  if (!prDiffFile) {
    console.error('PR_DIFF_FILE environment variable is required');
    process.exit(1);
  }

  // Read PR diff
  const fs = await import('fs/promises');
  const diff = await fs.readFile(prDiffFile, 'utf-8');

  const chunkedReview = process.env.CHUNKED_REVIEW !== 'false';

  const agent = new PRReviewAgent();
  const context: AgentContext = {
    workingDir: process.cwd(),
    repoOwner: config.repoOwner,
    repoName: config.repoName,
    prNumber,
  };

  const input: PRReviewAgentInput = {
    prNumber,
    suggestTests: true,
    focusAreas: ['security', 'logic', 'tests'],
    diff,
    chunkedReview,
  };

  agent.execute(input, context).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
