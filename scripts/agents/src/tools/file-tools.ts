import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File system tools for reading and writing files
 */
export function createFileTools(workingDir: string) {
  return {
    /**
     * Read a file from the working directory
     */
    readFile: tool({
      description: 'Read the contents of a file',
      inputSchema: z.object({
        filePath: z.string().describe('Path to the file relative to working directory'),
      }),
      execute: async ({ filePath }: { filePath: string }) => {
        try {
          const fullPath = path.resolve(workingDir, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          return {
            success: true,
            content,
            path: filePath,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path: filePath,
          };
        }
      },
    }),

    /**
     * Write content to a file
     */
    writeFile: tool({
      description: 'Write content to a file (creates parent directories if needed)',
      inputSchema: z.object({
        filePath: z.string().describe('Path to the file relative to working directory'),
        content: z.string().describe('Content to write'),
      }),
      execute: async ({ filePath, content }: { filePath: string; content: string }) => {
        try {
          const fullPath = path.resolve(workingDir, filePath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, 'utf-8');
          return {
            success: true,
            path: filePath,
            proposedChange: {
              filePath,
              type: 'create' as const,
              content,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path: filePath,
          };
        }
      },
    }),

    /**
     * List files in a directory
     */
    listFiles: tool({
      description: 'List files in a directory',
      inputSchema: z.object({
        dirPath: z.string().default('.').describe('Path to directory'),
        recursive: z.boolean().default(false).describe('List recursively'),
      }),
      execute: async ({ dirPath, recursive }: { dirPath: string; recursive: boolean }) => {
        try {
          const fullPath = path.resolve(workingDir, dirPath);
          const files: string[] = [];

          async function listDir(dir: string, prefix: string = '') {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const relativePath = path.join(prefix, entry.name);
              if (entry.isDirectory()) {
                if (recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                  await listDir(path.join(dir, entry.name), relativePath);
                }
              } else {
                files.push(relativePath);
              }
            }
          }

          await listDir(fullPath);
          return {
            success: true,
            files,
            count: files.length,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
            files: [],
          };
        }
      },
    }),

    /**
     * Check if a file exists
     */
    fileExists: tool({
      description: 'Check if a file or directory exists',
      inputSchema: z.object({
        filePath: z.string().describe('Path to check'),
      }),
      execute: async ({ filePath }: { filePath: string }) => {
        try {
          const fullPath = path.resolve(workingDir, filePath);
          await fs.access(fullPath);
          const stats = await fs.stat(fullPath);
          return {
            success: true,
            exists: true,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            path: filePath,
          };
        } catch {
          return {
            success: true,
            exists: false,
            path: filePath,
          };
        }
      },
    }),
  };
}
