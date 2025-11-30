import { useMemo, useState } from 'react'
import type { Asset } from '@shared/types'

type ContentBrowserProps = {
  assets: Asset[]
  onAssign: (_asset: Asset) => void
  onRefresh: () => Promise<void>
  activeDeckLabel: string
}

export const ContentBrowser = ({ assets, onAssign, onRefresh, activeDeckLabel }: ContentBrowserProps) => {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    if (!query) return assets
    return assets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()))
  }, [assets, query])

  const handleRefresh = async () => {
    setBusy(true)
    try {
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Content Browser</p>
          <h3>Assign to {activeDeckLabel}</h3>
        </div>
        <button type="button" onClick={handleRefresh} disabled={busy}>
          {busy ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      <input
        className="input"
        placeholder="Search clips"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="asset-grid">
        {filtered.length === 0 ? (
          <p className="muted">No assets found. Drop files into the mp4 folder and refresh.</p>
        ) : (
          filtered.map((asset) => (
            <button key={asset.id} type="button" className="asset-card" onClick={() => onAssign(asset)}>
              <span className="asset-card__name">{asset.name}</span>
              <span className="asset-card__meta">{asset.kind}</span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
