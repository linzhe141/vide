import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION_PATTERN = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/

const workspacePackageFiles = [
  'package.json',
  'apps/main/package.json',
  'apps/renderer/package.json',
  'packages/agent/package.json',
  'packages/ai/package.json',
  'packages/config/package.json',
]

const rawVersion = process.argv[2]

if (!rawVersion) {
  console.error('Usage: pnpm patch-version <version>')
  process.exit(1)
}

const match = VERSION_PATTERN.exec(rawVersion)

if (!match) {
  console.error(`Invalid version: ${rawVersion}`)
  process.exit(1)
}

const nextVersion = match[1]
const nextTag = rawVersion.startsWith('v') ? rawVersion : `v${nextVersion}`
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')

function runGitCommand(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

await Promise.all(
  workspacePackageFiles.map(async (relativeFilePath) => {
    const absoluteFilePath = path.join(repositoryRoot, relativeFilePath)
    const source = await readFile(absoluteFilePath, 'utf8')
    let replacements = 0
    const updated = source.replace(
      /("version"\s*:\s*")([^"]+)(")/,
      (_match, prefix, _current, suffix) => {
        replacements += 1
        return `${prefix}${nextVersion}${suffix}`
      }
    )

    if (replacements !== 1) {
      throw new Error(
        `Expected exactly one version field in ${relativeFilePath}, found ${replacements}`
      )
    }

    if (updated !== source) {
      await writeFile(absoluteFilePath, updated)
    }

    console.log(`${relativeFilePath}: ${nextVersion}`)
  })
)

const existingTag = runGitCommand(['tag', '--list', nextTag])

if (existingTag === nextTag) {
  throw new Error(`Git tag already exists: ${nextTag}`)
}

runGitCommand(['tag', '-a', nextTag, '-m', `Release ${nextTag}`])
console.log(`Created local git tag: ${nextTag}`)
console.warn(
  `Tag ${nextTag} points to the current HEAD. Commit the version file changes before pushing if you want the remote tag to include them.`
)
