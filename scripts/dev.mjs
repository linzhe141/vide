import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = process.cwd()

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, {
      cwd,
      stdio: 'inherit',
      shell: true,
    })

    p.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} failed: ${code}`))
    })
  })
}

function runWatch(cmd, cwd, name) {
  const p = spawn(cmd, {
    cwd,
    stdio: 'inherit',
    shell: true,
  })

  console.log(`[watch] ${name}`)
  return p
}

function getPackages() {
  const dir = path.join(ROOT, 'packages')

  return fs
    .readdirSync(dir)
    .filter((name) => {
      const pkgPath = path.join(dir, name)
      const stat = fs.statSync(pkgPath)

      // 只要目录
      return stat.isDirectory()
    })
    .map((name) => ({
      name,
      path: path.join('packages', name),
    }))
}

async function buildPackages(pkgs) {
  for (const pkg of pkgs) {
    console.log(`\n[build] ${pkg.name}`)
    await run('pnpm build', pkg.path)
  }
}

function startWatch(pkgs) {
  return pkgs.map((pkg) => runWatch('pnpm dev', path.resolve(pkg.path), pkg.name))
}

function startMain() {
  return runWatch('pnpm dev', path.resolve('apps/main'), 'main')
}

async function main() {
  const pkgs = getPackages()

  console.log(
    '📦 packages:',
    pkgs.map((p) => p.name)
  )

  console.log('\n🚀 build packages...')
  await buildPackages(pkgs)

  console.log('\n🔥 start watch...')

  startWatch(pkgs)

  startMain()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
