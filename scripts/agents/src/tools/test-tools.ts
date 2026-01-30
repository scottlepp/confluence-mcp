import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Tools for running tests
 */
export function createTestTools(workingDir: string) {
  return {
    /**
     * Run tests
     */
    runTests: tool({
      description: 'Run the project test suite',
      inputSchema: z.object({
        testFile: z.string().optional().describe('Specific test file to run'),
        coverage: z.boolean().default(false).describe('Run with coverage'),
      }),
      execute: async ({ testFile, coverage }: { testFile?: string; coverage: boolean }) => {
        try {
          let command = 'npm test';
          if (coverage) {
            command = 'npm run test:coverage';
          }
          if (testFile) {
            command += ` -- ${testFile}`;
          }

          const { stdout, stderr } = await execAsync(command, {
            cwd: workingDir,
            timeout: 300000, // 5 minute timeout
          });

          return {
            success: true,
            output: stdout,
            stderr,
          };
        } catch (error: unknown) {
          const execError = error as { stdout?: string; stderr?: string; message?: string };
          return {
            success: false,
            error: `Tests failed: ${execError.message || 'Unknown error'}`,
            output: execError.stdout || '',
            stderr: execError.stderr || '',
          };
        }
      },
    }),

    /**
     * Run type checking
     */
    runTypeCheck: tool({
      description: 'Run TypeScript type checking',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { stdout, stderr } = await execAsync('npm run build -- --noEmit', {
            cwd: workingDir,
            timeout: 120000,
          });

          return {
            success: true,
            output: stdout,
            stderr,
          };
        } catch (error: unknown) {
          const execError = error as { stdout?: string; stderr?: string; message?: string };
          return {
            success: false,
            error: `Type check failed: ${execError.message || 'Unknown error'}`,
            output: execError.stdout || '',
            stderr: execError.stderr || '',
          };
        }
      },
    }),

    /**
     * Run linting
     */
    runLint: tool({
      description: 'Run linter on the codebase',
      inputSchema: z.object({
        fix: z.boolean().default(false).describe('Auto-fix issues'),
      }),
      execute: async ({ fix }: { fix: boolean }) => {
        try {
          const command = fix ? 'npm run lint -- --fix' : 'npm run lint';
          const { stdout, stderr } = await execAsync(command, {
            cwd: workingDir,
            timeout: 120000,
          });

          return {
            success: true,
            output: stdout,
            stderr,
          };
        } catch (error: unknown) {
          const execError = error as { stdout?: string; stderr?: string; message?: string };
          return {
            success: false,
            error: `Lint failed: ${execError.message || 'Unknown error'}`,
            output: execError.stdout || '',
            stderr: execError.stderr || '',
          };
        }
      },
    }),

    /**
     * Install dependencies
     */
    installDependencies: tool({
      description: 'Install npm dependencies',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { stdout, stderr } = await execAsync('npm install', {
            cwd: workingDir,
            timeout: 300000,
          });

          return {
            success: true,
            output: stdout,
            stderr,
          };
        } catch (error: unknown) {
          const execError = error as { stdout?: string; stderr?: string; message?: string };
          return {
            success: false,
            error: `Install failed: ${execError.message || 'Unknown error'}`,
            output: execError.stdout || '',
            stderr: execError.stderr || '',
          };
        }
      },
    }),
  };
}
