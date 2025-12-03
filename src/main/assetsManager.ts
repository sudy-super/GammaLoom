import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import type { Asset, AssetKind } from '@shared/types'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])
const GLSL_EXTENSIONS = new Set(['.glsl', '.frag', '.fs'])

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
      await this.walk(root, root, results, seen)
    }

    return results.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async walk(target: string, baseRoot: string, bucket: Asset[], seen: Set<string>): Promise<void> {
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
          return this.walk(fullPath, baseRoot, bucket, seen)
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

        const relativePath = path.relative(baseRoot, fullPath)
        const folder = relativePath.split(path.sep)[0] ?? null
        const asset: Asset = {
          id: hashPath(fullPath),
          path: fullPath,
          url: buildAssetUrl(fullPath),
          name: dirent.name,
          kind,
          folder: folder ?? undefined,
        }

        if (kind === 'shader') {
          try {
            asset.code = await fs.readFile(fullPath, 'utf-8')
          } catch (_error) {
            asset.code = ''
          }
        }

        bucket.push(asset)
      }),
    )
  }

  private classify(filePath: string): AssetKind | null {
    const ext = path.extname(filePath).toLowerCase()
    if (VIDEO_EXTENSIONS.has(ext)) return 'video'
    if (IMAGE_EXTENSIONS.has(ext)) return 'image'
    if (GLSL_EXTENSIONS.has(ext)) return 'shader'
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

const buildAssetUrl = (fullPath: string) => {
  const fileUrl = pathToFileURL(fullPath).toString()
  if (fileUrl.startsWith('file://')) {
    return `vjasset://${fileUrl.slice('file://'.length)}`
  }
  return `vjasset://${fullPath}`
}
