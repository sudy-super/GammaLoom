import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import type { Asset, AssetKind } from '@shared/types'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])

export class AssetsManager {
  private readonly directories: string[]

  constructor(roots: string[]) {
    this.directories = roots
  }

  async listAssets(): Promise<Asset[]> {
    const results: Asset[] = []
    const seen = new Set<string>()

    for (const root of this.directories) {
      const directoryExists = await this.directoryExists(root)
      if (!directoryExists) continue
      await this.walk(root, results, seen)
    }

    return results.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async walk(target: string, bucket: Asset[], seen: Set<string>): Promise<void> {
    let dirents: Dirent[]
    try {
      dirents = await fs.readdir(target, { withFileTypes: true })
    } catch (_error) {
      return
    }
    await Promise.all(
      dirents.map(async (dirent) => {
        const fullPath = path.join(target, dirent.name)
        if (dirent.isDirectory()) {
          return this.walk(fullPath, bucket, seen)
        }

        if (!dirent.isFile()) {
          return
        }

        const kind = this.classify(fullPath)
        if (!kind) {
          return
        }

        if (seen.has(fullPath)) {
          return
        }
        seen.add(fullPath)

        bucket.push({
          id: hashPath(fullPath),
          path: fullPath,
          url: pathToFileURL(fullPath).toString(),
          name: dirent.name,
          kind,
        })
      }),
    )
  }

  private classify(filePath: string): AssetKind | null {
    const ext = path.extname(filePath).toLowerCase()
    if (VIDEO_EXTENSIONS.has(ext)) return 'video'
    if (IMAGE_EXTENSIONS.has(ext)) return 'image'
    return null
  }

  private async directoryExists(target: string): Promise<boolean> {
    try {
      const stats = await fs.stat(target)
      return stats.isDirectory()
    } catch (_error) {
      return false
    }
  }
}

const hashPath = (value: string) =>
  crypto
    .createHash('sha1')
    .update(value)
    .digest('hex')
