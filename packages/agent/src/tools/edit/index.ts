import { defineTool, ToolProvider } from '../toolProvider'
import fs from 'fs/promises'
import { createPatch } from 'diff'
import { resolveWorkspacePath } from '../../workspace'
import { ToolCallError } from '../../error'

export const EDIT_TOOL_NAMES = {
  SEARCH_REPLACE: `search-replace`,
  EDIT_FILE: `edit-file`,
} as const

interface EditText {
  oldText: string
  newText: string
}

export class Edit extends ToolProvider {
  searchReplace = defineTool({
    name: EDIT_TOOL_NAMES.SEARCH_REPLACE,
    type: 'function',
    function: {
      name: EDIT_TOOL_NAMES.SEARCH_REPLACE,
      description: `Search for text using a regular expression pattern and replace all matches in a file.
Use this for pattern-based search-and-replace operations on **single-line text**.

### How it works:
- Uses the provided \`oldText\` as a regular expression pattern with the \`g\` (global) flag
- Replaces **all matches** found with \`newText\`
- Works best for single-line patterns
- Returns a unified diff showing the changes made

### Key characteristics:
- Supports regex pattern matching
- Global replacement across the entire file
- Good for bulk changes that follow a pattern

### ✅ When to use:
- Bulk replacing text patterns across multiple lines (single-line matches)
- Pattern-based refactoring (e.g., changing naming conventions)
- Quick search-and-replace operations where regex is useful

### ❌ When NOT to use:
- Multi-line search/replace → use \`edit-file\`
- Exact literal replacement when you don't need regex → use \`edit-file\`
- Replacing large blocks of code → use \`edit-file\` or \`write-file\`

${this.runtime.workspacePath ? `Workspace: ${this.runtime.workspacePath}` : 'No workspace path set'}
`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (absolute or relative)',
          },
          oldText: {
            type: 'string',
            description: 'Regular expression pattern to search for. Will be used with /g flag.',
          },
          newText: {
            type: 'string',
            description: 'Text to replace matches with',
          },
        },
        required: ['path', 'oldText', 'newText'],
      },
    },

    executor: async (args: any = {}) => {
      const { path: filePath, oldText, newText } = args

      if (!filePath) {
        throw new ToolCallError('Path is required')
      }

      if (typeof oldText !== 'string' || oldText === '') {
        throw new ToolCallError('oldText must be a non-empty string')
      }

      if (typeof newText !== 'string') {
        throw new ToolCallError('newText must be a string')
      }

      try {
        const fullPath = resolveWorkspacePath(this.runtime.workspacePath, filePath)
        const content = await fs.readFile(fullPath, 'utf8')

        let regex: RegExp
        try {
          regex = new RegExp(oldText, 'g')
        } catch (_error: any) {
          throw new ToolCallError(`Invalid regular expression: ${oldText}`)
        }

        const matches = content.match(regex)
        if (!matches || matches.length === 0) {
          throw new ToolCallError(`No matches found for pattern "${oldText}" in ${filePath}`)
        }

        const newContent = content.replace(regex, newText)

        if (content === newContent) {
          throw new ToolCallError(
            `No changes made to ${filePath}. The replacement produced identical content.`
          )
        }

        const {
          diff: diffText,
          linesAdded,
          linesDeleted,
        } = buildDiff(filePath, content, newContent)

        await fs.writeFile(fullPath, newContent, 'utf8')
        const stats = await fs.stat(fullPath)

        return {
          reason: 'call-llm',
          result: {
            success: true,
            path: fullPath,
            size: stats.size,
            message: `Successfully replaced ${matches.length} match(es) in ${filePath}. (+${linesAdded} -${linesDeleted} lines)`,
            diff: diffText,
            linesAdded,
            linesDeleted,
            replacements: matches.length,
          },
        }
      } catch (error: any) {
        console.log('search_replace error', error)
        throw new ToolCallError(
          `Failed to replace text: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
  })

  editFile = defineTool({
    name: EDIT_TOOL_NAMES.EDIT_FILE,
    type: 'function',
    function: {
      name: EDIT_TOOL_NAMES.EDIT_FILE,
      description: `Apply **targeted, localized edits** to specific sections of a file.
Use this for making focused changes to existing code while preserving most of the file content.

### How it works:
- Each edit replaces **all exact occurrences** of \`oldText\` with \`newText\`
- All edits are applied against the **original file content** (not incrementally)
- \`oldText\` must match **exactly**, including all whitespace, indentation, and line endings
- Returns a unified diff showing all changes made

### Key characteristics:
- Changes are **localized** (not rewriting the entire file)
- Multiple non-overlapping edits can be applied in one operation
- Preserves git history better than full rewrite for small changes

### ✅ When to use:
- Refactoring specific function bodies
- Fixing a bug in a localized section
- Renaming variables/functions across multiple occurrences
- Updating imports or configuration values
- Day-to-day incremental code modifications

### ❌ When NOT to use:
- Creating a completely new file → use \`write-file\`
- Rewriting the entire file → use \`write-file\`
- Extensive changes with large overlapping sections → split into multiple edits or use \`write-file\`

${this.runtime.workspacePath ? `Workspace: ${this.runtime.workspacePath}` : 'No workspace path set'}
`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (absolute or relative)',
          },
          edits: {
            type: 'array',
            description: 'Array of edit operations to apply',
            items: {
              type: 'object',
              properties: {
                oldText: {
                  type: 'string',
                  description: 'Exact text to replace. All occurrences will be replaced.',
                },
                newText: {
                  type: 'string',
                  description: 'Text to replace it with',
                },
              },
              required: ['oldText', 'newText'],
            },
          },
        },
        required: ['path', 'edits'],
      },
    },

    executor: async (args: any = {}) => {
      const { path: filePath, edits } = args

      if (!filePath) {
        throw new ToolCallError('Path is required')
      }

      if (!Array.isArray(edits) || edits.length === 0) {
        throw new ToolCallError(
          `edits must be an array with at least one { oldText, newText } object`
        )
      }

      try {
        const fullPath = resolveWorkspacePath(this.runtime.workspacePath, filePath)
        const content = await fs.readFile(fullPath, 'utf8')

        const result = applyEdits(content, edits, filePath)

        if (content === result.newContent) {
          throw new ToolCallError(
            `No changes made to ${filePath}. The replacements produced identical content.`
          )
        }

        const {
          diff: diffText,
          linesAdded,
          linesDeleted,
        } = buildDiff(filePath, content, result.newContent)

        await fs.writeFile(fullPath, result.newContent, 'utf8')
        const stats = await fs.stat(fullPath)

        return {
          reason: 'call-llm',
          result: {
            success: true,
            path: fullPath,
            size: stats.size,
            message: `Successfully applied ${edits.length} edit(s) to ${filePath}. (+${linesAdded} -${linesDeleted} lines)`,
            diff: diffText,
            linesAdded,
            linesDeleted,
            replacements: result.totalReplacements,
          },
        }
      } catch (error: any) {
        console.log('edit_file error', error)
        throw new ToolCallError(
          `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
  })

  getTools() {
    return [this.searchReplace, this.editFile]
  }
}

function applyEdits(
  content: string,
  edits: EditText[],
  filePath: string
): { newContent: string; totalReplacements: number } {
  let totalReplacements = 0

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i]

    if (!edit.oldText && edit.oldText !== '') {
      throw new ToolCallError(`edits[${i}].oldText must not be empty`)
    }

    if (!content.includes(edit.oldText)) {
      throw new ToolCallError(
        `Cannot find edits[${i}].oldText in ${filePath}. ` +
          `Text must match exactly including whitespace and newlines.`
      )
    }
  }

  interface MatchPosition {
    editIndex: number
    start: number
    end: number
    oldText: string
    newText: string
  }

  const allMatches: MatchPosition[] = []

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i]
    let startIndex = 0

    while (true) {
      const index = content.indexOf(edit.oldText, startIndex)
      if (index === -1) break

      allMatches.push({
        editIndex: i,
        start: index,
        end: index + edit.oldText.length,
        oldText: edit.oldText,
        newText: edit.newText,
      })

      startIndex = index + 1
    }
  }

  allMatches.sort((a, b) => b.start - a.start)

  for (let i = 0; i < allMatches.length - 1; i++) {
    for (let j = i + 1; j < allMatches.length; j++) {
      const a = allMatches[i]
      const b = allMatches[j]

      if (a.editIndex !== b.editIndex) {
        if (b.start < a.end && a.start < b.end) {
          throw new ToolCallError(
            `edits[${a.editIndex}] and edits[${b.editIndex}] overlap in ${filePath}. ` +
              `Merge them into one edit or target disjoint regions.`
          )
        }
      }
    }
  }

  let newContent = content
  for (const match of allMatches) {
    newContent =
      newContent.substring(0, match.start) + match.newText + newContent.substring(match.end)
    totalReplacements++
  }

  return { newContent, totalReplacements }
}

function buildDiff(filePath: string, content: string, newContent: string) {
  const patch = createPatch(filePath, content, newContent, '', '')
  const diffText = `diff --git a/${filePath} b/${filePath}\n${patch}`

  const patchLines = patch.split('\n')
  let linesAdded = 0
  let linesDeleted = 0

  for (const line of patchLines) {
    if (line.startsWith('+') && !line.startsWith('+++')) linesAdded++
    else if (line.startsWith('-') && !line.startsWith('---')) linesDeleted++
  }

  return {
    diff: diffText,
    linesAdded,
    linesDeleted,
  }
}
