import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

// Known project shortcuts
const PROJECT_SHORTCUTS: Record<string, string> = {
  'strings': 'C:/Users/venti/NextJS_Projects/strings',
  'ventiaam': 'C:/Users/venti/NextJS_Projects/ventiaam',
};

function resolveProjectPath(projectPath: string): string {
  // Check if it's a shortcut
  const shortcut = projectPath.toLowerCase().trim();
  if (PROJECT_SHORTCUTS[shortcut]) {
    return PROJECT_SHORTCUTS[shortcut];
  }
  // Otherwise return as-is (should be full path)
  return projectPath;
}

// Security: only allow access to specific directories
function isPathAllowed(targetPath: string): boolean {
  const normalizedPath = path.normalize(targetPath).toLowerCase();
  const allowedPaths = [
    'c:\\users\\venti\\nextjs_projects',
    'c:/users/venti/nextjs_projects',
  ];
  return allowedPaths.some(allowed => normalizedPath.startsWith(allowed.toLowerCase()));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, projectPath, filePath, query, limit, filePattern } = body;

    const resolvedPath = projectPath ? resolveProjectPath(projectPath) : '';
    
    // Security check
    if (resolvedPath && !isPathAllowed(resolvedPath)) {
      return NextResponse.json({ 
        error: 'Access denied: Path not in allowed directories' 
      }, { status: 403 });
    }

    switch (action) {
      case 'get_project_info': {
        if (!resolvedPath) {
          return NextResponse.json({ error: 'projectPath is required' }, { status: 400 });
        }

        const result: Record<string, unknown> = { projectPath: resolvedPath };

        // Read README if exists
        try {
          const readmePath = path.join(resolvedPath, 'README.md');
          const readme = await fs.readFile(readmePath, 'utf-8');
          // Truncate for voice context
          result.readme = readme.length > 2000 ? readme.substring(0, 2000) + '...' : readme;
        } catch {
          result.readme = null;
        }

        // Read package.json if exists
        try {
          const pkgPath = path.join(resolvedPath, 'package.json');
          const pkgContent = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          result.packageJson = {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            scripts: Object.keys(pkg.scripts || {}),
            dependencies: Object.keys(pkg.dependencies || {}).slice(0, 20),
            devDependencies: Object.keys(pkg.devDependencies || {}).slice(0, 10),
          };
        } catch {
          result.packageJson = null;
        }

        // Get top-level directory structure
        try {
          const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
          const structure = entries
            .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
            .slice(0, 30)
            .map(e => ({
              name: e.name,
              type: e.isDirectory() ? 'dir' : 'file'
            }));
          result.structure = structure;
        } catch {
          result.structure = [];
        }

        return NextResponse.json({ success: true, result });
      }

      case 'read_code_file': {
        if (!filePath) {
          return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
        }

        const fullPath = resolvedPath 
          ? path.join(resolvedPath, filePath) 
          : filePath;

        // Security check for full path
        if (!isPathAllowed(fullPath)) {
          return NextResponse.json({ 
            error: 'Access denied: Path not in allowed directories' 
          }, { status: 403 });
        }

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          // Truncate large files for voice context
          const truncatedContent = content.length > 5000 
            ? content.substring(0, 5000) + '\n\n... [truncated - file has ' + content.length + ' characters]'
            : content;
          
          return NextResponse.json({ 
            success: true, 
            result: {
              path: fullPath,
              content: truncatedContent,
              size: content.length
            }
          });
        } catch (err) {
          return NextResponse.json({ 
            error: `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}` 
          }, { status: 404 });
        }
      }

      case 'git_recent_changes': {
        if (!resolvedPath) {
          return NextResponse.json({ error: 'projectPath is required' }, { status: 400 });
        }

        const commitLimit = limit || 10;

        try {
          // Get recent commits
          const { stdout: logOutput } = await execAsync(
            `git --no-pager log --oneline -n ${commitLimit}`,
            { cwd: resolvedPath }
          );

          // Get current status
          const { stdout: statusOutput } = await execAsync(
            'git --no-pager status --short',
            { cwd: resolvedPath }
          );

          // Get current branch
          const { stdout: branchOutput } = await execAsync(
            'git --no-pager branch --show-current',
            { cwd: resolvedPath }
          );

          return NextResponse.json({
            success: true,
            result: {
              branch: branchOutput.trim(),
              recentCommits: logOutput.trim().split('\n').filter(Boolean),
              uncommittedChanges: statusOutput.trim().split('\n').filter(Boolean),
            }
          });
        } catch (err) {
          return NextResponse.json({ 
            error: `Git command failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
          }, { status: 500 });
        }
      }

      case 'search_code': {
        if (!query || !resolvedPath) {
          return NextResponse.json({ error: 'query and projectPath are required' }, { status: 400 });
        }

        try {
          // Use grep/findstr to search (cross-platform approach using git grep)
          const pattern = filePattern || '*.ts,*.tsx,*.js,*.jsx,*.json,*.md';
          const extensions = pattern.split(',').map(p => p.trim());
          
          // Build include patterns for git grep
          const includeArgs = extensions.map(ext => `--include="${ext}"`).join(' ');
          
          const { stdout } = await execAsync(
            `git --no-pager grep -n -i "${query.replace(/"/g, '\\"')}" -- ${extensions.map(e => `"${e}"`).join(' ')}`,
            { cwd: resolvedPath, maxBuffer: 1024 * 1024 }
          ).catch(() => ({ stdout: '' }));

          const matches = stdout.trim().split('\n')
            .filter(Boolean)
            .slice(0, 20) // Limit results for voice
            .map(line => {
              const [file, ...rest] = line.split(':');
              return { file, match: rest.join(':').substring(0, 100) };
            });

          return NextResponse.json({
            success: true,
            result: {
              query,
              matchCount: matches.length,
              matches
            }
          });
        } catch (err) {
          return NextResponse.json({ 
            error: `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
          }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[code-tools] Error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Internal server error' 
    }, { status: 500 });
  }
}
