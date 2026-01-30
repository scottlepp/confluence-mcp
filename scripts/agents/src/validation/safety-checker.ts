import { AgentContext, ProposedChange } from '../agents/types.js';

/**
 * Safety patterns to detect potentially harmful code/requests
 */
const HARMFUL_PATTERNS = [
  // Security bypass
  /bypass.*auth/i,
  /disable.*security/i,
  /remove.*validation/i,
  /skip.*check/i,

  // Credential exposure
  /hardcode.*password/i,
  /expose.*secret/i,
  /log.*credential/i,
  /print.*token/i,

  // Destructive operations
  /delete.*all/i,
  /drop.*database/i,
  /rm\s+-rf/i,
  /truncate.*table/i,

  // Malicious code injection
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  /__import__/i,
];

/**
 * File patterns that should never be modified
 */
const PROTECTED_FILES = [
  /\.env$/i,
  /\.env\..*/i,
  /credentials/i,
  /secrets/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\.ssh/i,
];

/**
 * Tool operations that require extra validation
 */
const SENSITIVE_TOOLS = [
  'deleteFile',
  'executeCommand',
  'modifyConfig',
  'pushToRemote',
];

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class SafetyChecker {
  /**
   * Check if a tool call is safe to execute
   */
  async checkToolCall(
    toolName: string,
    args: Record<string, unknown>,
    context: AgentContext
  ): Promise<SafetyCheckResult> {
    // Check if tool is sensitive
    if (SENSITIVE_TOOLS.includes(toolName)) {
      // Additional validation for sensitive tools
      if (toolName === 'deleteFile') {
        const path = args.path as string;
        if (this.isProtectedFile(path)) {
          return {
            safe: false,
            reason: `Cannot delete protected file: ${path}`,
            severity: 'critical',
          };
        }
      }

      if (toolName === 'executeCommand') {
        const command = args.command as string;
        if (this.containsHarmfulPattern(command)) {
          return {
            safe: false,
            reason: `Potentially harmful command detected: ${command}`,
            severity: 'high',
          };
        }
      }
    }

    return { safe: true };
  }

  /**
   * Check if a proposed change is safe to apply
   */
  async checkChange(change: ProposedChange): Promise<SafetyCheckResult> {
    // Check if file is protected
    if (this.isProtectedFile(change.filePath)) {
      return {
        safe: false,
        reason: `Cannot modify protected file: ${change.filePath}`,
        severity: 'critical',
      };
    }

    // Check content for harmful patterns
    if (change.content && this.containsHarmfulPattern(change.content)) {
      return {
        safe: false,
        reason: 'Content contains potentially harmful patterns',
        severity: 'high',
      };
    }

    return { safe: true };
  }

  /**
   * Validate an issue for auto-fix eligibility
   */
  validateIssueForAutoFix(
    title: string,
    body: string
  ): { safe: boolean; reason?: string } {
    const combined = `${title} ${body}`;

    // Check for harmful patterns in the issue
    if (this.containsHarmfulPattern(combined)) {
      return {
        safe: false,
        reason: 'Issue contains potentially harmful request patterns',
      };
    }

    // Check for requests to modify protected resources
    for (const pattern of PROTECTED_FILES) {
      if (pattern.test(combined)) {
        return {
          safe: false,
          reason: 'Issue requests modification of protected files',
        };
      }
    }

    return { safe: true };
  }

  /**
   * Check if a file path matches protected patterns
   */
  private isProtectedFile(path: string): boolean {
    return PROTECTED_FILES.some((pattern) => pattern.test(path));
  }

  /**
   * Check if content contains harmful patterns
   */
  private containsHarmfulPattern(content: string): boolean {
    return HARMFUL_PATTERNS.some((pattern) => pattern.test(content));
  }
}
