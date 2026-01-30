import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Git tools for repository operations
 */
export function createGitTools(workingDir: string) {
  async function runGit(args: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(`git ${args}`, { cwd: workingDir });
  }

  return {
    /**
     * Get the current branch name
     */
    getCurrentBranch: tool({
      description: 'Get the name of the current git branch',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { stdout } = await runGit('rev-parse --abbrev-ref HEAD');
          return {
            success: true,
            branch: stdout.trim(),
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Create and checkout a new branch
     */
    createBranch: tool({
      description: 'Create and checkout a new git branch',
      inputSchema: z.object({
        branchName: z.string().describe('Name of the new branch'),
        baseBranch: z.string().default('main').describe('Base branch to create from'),
      }),
      execute: async ({ branchName, baseBranch }: { branchName: string; baseBranch: string }) => {
        try {
          await runGit(`checkout ${baseBranch}`);
          await runGit(`pull origin ${baseBranch}`);
          await runGit(`checkout -b ${branchName}`);
          return {
            success: true,
            branch: branchName,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Stage files for commit
     */
    stageFiles: tool({
      description: 'Stage files for commit',
      inputSchema: z.object({
        files: z.array(z.string()).describe('Files to stage (or ["."] for all)'),
      }),
      execute: async ({ files }: { files: string[] }) => {
        try {
          const fileList = files.join(' ');
          await runGit(`add ${fileList}`);
          return {
            success: true,
            stagedFiles: files,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to stage files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Commit staged changes
     */
    commit: tool({
      description: 'Commit staged changes',
      inputSchema: z.object({
        message: z.string().describe('Commit message'),
      }),
      execute: async ({ message }: { message: string }) => {
        try {
          const { stdout } = await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
          return {
            success: true,
            message,
            output: stdout,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Push changes to remote
     */
    push: tool({
      description: 'Push changes to remote repository',
      inputSchema: z.object({
        branch: z.string().describe('Branch to push'),
        setUpstream: z.boolean().default(true).describe('Set upstream tracking'),
      }),
      execute: async ({ branch, setUpstream }: { branch: string; setUpstream: boolean }) => {
        try {
          const upstreamFlag = setUpstream ? '-u' : '';
          await runGit(`push ${upstreamFlag} origin ${branch}`);
          return {
            success: true,
            branch,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to push: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    /**
     * Get git status
     */
    getStatus: tool({
      description: 'Get git status showing changed files',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { stdout } = await runGit('status --porcelain');
          const files = stdout
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => ({
              status: line.substring(0, 2).trim(),
              file: line.substring(3),
            }));
          return {
            success: true,
            files,
            hasChanges: files.length > 0,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`,
            files: [],
          };
        }
      },
    }),

    /**
     * Get diff of changes
     */
    getDiff: tool({
      description: 'Get diff of changes',
      inputSchema: z.object({
        staged: z.boolean().default(false).describe('Show staged changes only'),
        file: z.string().optional().describe('Specific file to diff'),
      }),
      execute: async ({ staged, file }: { staged: boolean; file?: string }) => {
        try {
          const stagedFlag = staged ? '--staged' : '';
          const fileArg = file || '';
          const { stdout } = await runGit(`diff ${stagedFlag} ${fileArg}`);
          return {
            success: true,
            diff: stdout,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get diff: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
  };
}
