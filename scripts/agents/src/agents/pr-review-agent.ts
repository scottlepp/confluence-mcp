import { ToolSet } from 'ai';
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

/**
 * PR Review Agent - Reviews pull requests and suggests improvements
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

SEVERITY LEVELS:
- critical: Security vulnerabilities, data loss risks, breaking changes
- high: Bugs, significant performance issues, logic errors
- medium: Code quality issues, missing error handling
- low: Style issues, minor improvements
- info: Suggestions, nice-to-haves

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
    return `Review PR #${input.prNumber} in repository ${context.repoOwner}/${context.repoName}.

Focus areas: ${input.focusAreas?.join(', ') || 'all areas'}
Suggest tests: ${input.suggestTests !== false ? 'yes' : 'no'}

PR Diff:
\`\`\`diff
${input.diff || 'No diff provided'}
\`\`\`

---

Instructions:
1. Analyze each file's changes
2. ${input.suggestTests !== false ? 'Suggest test files based on the changed files' : 'Note any missing test coverage'}
3. For EACH specific issue you find, note the file path and line number
4. Use createReview to submit your review with inline comments`;
  }

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

    this.log('info', 'Starting PR review', { input });

    try {
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
  };

  agent.execute(input, context).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
