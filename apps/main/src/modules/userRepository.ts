import { desc, eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { GitHubAuthUser } from '@vide/config'
import { db } from '@/db/databaseManager'
import { users } from '@/db/schema'

export class UserRepository {
  static async upsertGitHubUser(data: {
    githubId: string
    username: string
    avatarUrl: string | null
    email: string | null
    accessToken: string
  }): Promise<GitHubAuthUser> {
    const time = Date.now()
    const rows = await db.select().from(users).where(eq(users.githubId, data.githubId))
    const existing = rows[0]

    if (existing) {
      await db
        .update(users)
        .set({
          username: data.username,
          avatarUrl: data.avatarUrl,
          email: data.email,
          accessToken: data.accessToken,
          updatedAt: time,
        })
        .where(eq(users.id, existing.id))

      return {
        id: existing.id,
        githubId: data.githubId,
        username: data.username,
        avatarUrl: data.avatarUrl,
        email: data.email,
        createdAt: existing.createdAt,
        updatedAt: time,
      }
    }

    const id = uuid()
    await db.insert(users).values({
      id,
      githubId: data.githubId,
      username: data.username,
      avatarUrl: data.avatarUrl,
      email: data.email,
      accessToken: data.accessToken,
      createdAt: time,
      updatedAt: time,
    })

    return {
      id,
      githubId: data.githubId,
      username: data.username,
      avatarUrl: data.avatarUrl,
      email: data.email,
      createdAt: time,
      updatedAt: time,
    }
  }

  static async getCurrentUser(): Promise<GitHubAuthUser | null> {
    const rows = await db.select().from(users).orderBy(desc(users.updatedAt)).limit(1)
    const currentUser = rows[0]
    if (!currentUser) return null

    return {
      id: currentUser.id,
      githubId: currentUser.githubId,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
      email: currentUser.email,
      createdAt: currentUser.createdAt,
      updatedAt: currentUser.updatedAt,
    }
  }

  static async clear(): Promise<void> {
    await db.delete(users)
  }
}
