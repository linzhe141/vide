import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '@/db/schema'
import { app } from 'electron'
import path from 'path'
import type { AppManager } from './appManager'
import { logger } from './logger'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const dbPath = path.join(app.getPath('userData'), 'data.db')

logger.info('db path', dbPath)

const sqlite = new Database(dbPath)

export const db = drizzle(sqlite, { schema })

export class DatabaseManager {
  constructor(private app: AppManager) {}

  async init() {
    await this.runMigrate()
  }

  private async runMigrate() {
    logger.info('Running database migrations...')
    migrate(db, {
      migrationsFolder: path.join(__dirname, '../../../drizzle'),
    })
    logger.info('Run database migrations successfully')
  }

  async execute(sqlstr: any, params: any, method: any) {
    const result = sqlite.prepare(sqlstr) as any
    const ret = result[method](...params)
    return toDrizzleResult(ret)
  }
}

// for renderer uses drrizle api
function toDrizzleResult(row: Record<string, any>): any
function toDrizzleResult(rows: Record<string, any> | Array<Record<string, any>>): any {
  if (!rows) {
    return []
  }
  if (Array.isArray(rows)) {
    return rows.map((row) => {
      return Object.keys(row).map((key) => row[key])
    })
  } else {
    return Object.keys(rows).map((key) => rows[key])
  }
}
