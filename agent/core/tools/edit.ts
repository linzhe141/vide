import fs from 'fs/promises'
import path from 'path'
import * as Diff from 'diff'
import type { Tool } from '@/agent/core/types'

interface Edit {
  oldText: string
  newText: string
}

function generateDiff(oldContent: string, newContent: string): string {
  const parts = Diff.diffLines(oldContent, newContent)
  const output: string[] = []

  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const maxLineNum = Math.max(oldLines.length, newLines.length)
  const lineNumWidth = String(maxLineNum).length

  let oldLineNum = 1
  let newLineNum = 1

  for (const part of parts) {
    const raw = part.value.split('\n')
    if (raw[raw.length - 1] === '') {
      raw.pop()
    }

    for (const line of raw) {
      if (part.added) {
        const lineNum = String(newLineNum).padStart(lineNumWidth, ' ')
        output.push(`+${lineNum} ${line}`)
        newLineNum++
      } else if (part.removed) {
        const lineNum = String(oldLineNum).padStart(lineNumWidth, ' ')
        output.push(`-${lineNum} ${line}`)
        oldLineNum++
      } else {
        const lineNum = String(oldLineNum).padStart(lineNumWidth, ' ')
        output.push(` ${lineNum} ${line}`)
        oldLineNum++
        newLineNum++
      }
    }
  }

  return output.join('\n')
}

function normalizeToLF(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function restoreLineEndings(text: string, original: string): string {
  if (original.includes('\r\n')) {
    return text.replace(/\n/g, '\r\n')
  }
  if (original.includes('\r') && !original.includes('\r\n')) {
    return text.replace(/\n/g, '\r')
  }
  return text
}

function applyEdits(
  content: string,
  edits: Edit[],
  filePath: string
): { baseContent: string; newContent: string } {
  const normalizedContent = normalizeToLF(content)
  const normalizedEdits = edits.map((edit) => ({
    oldText: normalizeToLF(edit.oldText),
    newText: normalizeToLF(edit.newText),
  }))

  // Validate all edits
  for (let i = 0; i < normalizedEdits.length; i++) {
    const edit = normalizedEdits[i]

    if (!edit.oldText && edit.oldText !== '') {
      throw new Error(`edits[${i}].oldText must not be empty`)
    }

    // Find in content
    const index = normalizedContent.indexOf(edit.oldText)
    if (index === -1) {
      throw new Error(
        `Cannot find edits[${i}].oldText in ${filePath}. ` +
          `Text must match exactly including whitespace and newlines.`
      )
    }

    // Check uniqueness
    const secondIndex = normalizedContent.indexOf(edit.oldText, index + 1)
    if (secondIndex !== -1) {
      const occurrences = normalizedContent.split(edit.oldText).length - 1
      throw new Error(
        `Found ${occurrences} occurrences of edits[${i}].oldText in ${filePath}. ` +
          `Each oldText must be unique. Provide more context.`
      )
    }
  }

  // Collect match positions
  interface MatchedEdit {
    editIndex: number
    matchIndex: number
    matchLength: number
    newText: string
  }

  const matchedEdits: MatchedEdit[] = normalizedEdits.map((edit, i) => ({
    editIndex: i,
    matchIndex: normalizedContent.indexOf(edit.oldText),
    matchLength: edit.oldText.length,
    newText: edit.newText,
  }))

  // Check for overlaps
  matchedEdits.sort((a, b) => a.matchIndex - b.matchIndex)
  for (let i = 1; i < matchedEdits.length; i++) {
    const prev = matchedEdits[i - 1]
    const curr = matchedEdits[i]
    if (prev.matchIndex + prev.matchLength > curr.matchIndex) {
      throw new Error(
        `edits[${prev.editIndex}] and edits[${curr.editIndex}] overlap in ${filePath}. ` +
          `Merge them into one edit or target disjoint regions.`
      )
    }
  }

  // Apply edits in reverse order to preserve offsets
  let newContent = normalizedContent
  for (let i = matchedEdits.length - 1; i >= 0; i--) {
    const edit = matchedEdits[i]
    newContent =
      newContent.substring(0, edit.matchIndex) +
      edit.newText +
      newContent.substring(edit.matchIndex + edit.matchLength)
  }

  if (normalizedContent === newContent) {
    throw new Error(`No changes made to ${filePath}. The replacements produced identical content.`)
  }

  return { baseContent: normalizedContent, newContent }
}

export const fsEditFile: Tool = {
  name: 'fs_edit_file',
  type: 'function',
  function: {
    name: 'fs_edit_file',
    description: `
Edit a file by performing one or more exact text replacements.

Each edit replaces oldText with newText in the file. All edits are matched 
against the original file content (not incrementally). The text must match 
exactly including all whitespace, indentation, and newlines.

Multiple edits must not overlap - if they do, merge them into one edit instead.
Each oldText must be unique in the file.

The path can be either absolute or relative.
Returns a unified diff showing the changes made.
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
                description: 'Exact text to replace. Must be unique in the file.',
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

  async executor(args: any = {}) {
    const { path: filePath, edits } = args

    if (!filePath) {
      return {
        reason: 'call-llm',
        result: { success: false, error: 'Path is required' },
      }
    }

    if (!Array.isArray(edits) || edits.length === 0) {
      return {
        reason: 'call-llm',
        result: {
          success: false,
          error: 'edits must be an array with at least one { oldText, newText } object',
        },
      }
    }

    try {
      const fullPath = path.resolve(filePath)

      // Read file
      const content = await fs.readFile(fullPath, 'utf8')

      // Apply edits
      const { baseContent, newContent } = applyEdits(content, edits, filePath)

      // Generate diff
      const diff = generateDiff(baseContent, newContent)

      // Restore original line endings
      const finalContent = restoreLineEndings(newContent, content)

      // Write back
      await fs.writeFile(fullPath, finalContent, 'utf8')

      const stats = await fs.stat(fullPath)

      // Count changes
      const linesAdded = diff
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
      const linesRemoved = diff
        .split('\n')
        .filter((l) => l.startsWith('-') && !l.startsWith('---')).length

      return {
        reason: 'call-llm',
        result: {
          success: true,
          path: fullPath,
          size: stats.size,
          message: `Successfully applied ${edits.length} edit(s) to ${filePath}. (+${linesAdded} -${linesRemoved} lines)`,
          diff,
        },
      }
    } catch (error: any) {
      console.log('fs_edit_file error', error)
      return {
        reason: 'call-llm',
        result: {
          success: false,
          error: error.message,
        },
      }
    }
  },
}
