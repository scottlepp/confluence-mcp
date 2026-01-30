import { AgentContext, ProposedChange, ValidationResult } from '../agents/types.js';

/**
 * Validates proposed changes before they are applied
 */
export class ChangeValidator {
  /**
   * Validate a proposed change
   */
  async validate(
    change: ProposedChange,
    context: AgentContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate file path
    if (!change.filePath) {
      errors.push('File path is required');
    }

    // Validate change type
    if (!['create', 'modify', 'delete'].includes(change.type)) {
      errors.push(`Invalid change type: ${change.type}`);
    }

    // For create/modify, content is required
    if (['create', 'modify'].includes(change.type) && !change.content) {
      errors.push('Content is required for create/modify operations');
    }

    // Check for common issues
    if (change.content) {
      // Check for trailing whitespace in files that typically shouldn't have it
      if (change.filePath.match(/\.(ts|js|json|yml|yaml)$/)) {
        const lines = change.content.split('\n');
        const linesWithTrailingWhitespace = lines.filter(
          (line, i) => line !== lines[lines.length - 1] && line.endsWith(' ')
        );
        if (linesWithTrailingWhitespace.length > 0) {
          warnings.push('Content contains trailing whitespace');
        }
      }

      // Check for console.log in production code
      if (
        change.filePath.match(/\/src\/.*\.(ts|js)$/) &&
        !change.filePath.includes('.test.') &&
        change.content.includes('console.log')
      ) {
        warnings.push('Content contains console.log statements');
      }

      // Check for TODO comments
      if (change.content.match(/\/\/\s*TODO/i)) {
        warnings.push('Content contains TODO comments');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate multiple changes
   */
  async validateAll(
    changes: ProposedChange[],
    context: AgentContext
  ): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const change of changes) {
      const result = await this.validate(change, context);
      allErrors.push(...result.errors.map((e) => `${change.filePath}: ${e}`));
      allWarnings.push(
        ...result.warnings.map((w) => `${change.filePath}: ${w}`)
      );
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
