'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Image as ImageIcon, Loader2, MessageSquarePlus, Sparkles, X } from 'lucide-react'
import { Asset } from '@/lib/types'

interface AssetLibraryProps {
  isOpen: boolean
  onClose: () => void
  onUseInChat?: (prompt: string) => void
}

const ASSET_TYPES: { value: Asset['assetType']; label: string }[] = [
  { value: 'item', label: 'Item' },
  { value: 'character', label: 'Karakter' },
  { value: 'background', label: 'Achtergrond' },
  { value: 'icon', label: 'Icon' },
]

export function AssetLibrary({ isOpen, onClose, onUseInChat }: AssetLibraryProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [assetType, setAssetType] = useState<Asset['assetType']>('item')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    fetch('/api/assets')
      .then(response => response.json())
      .then(data => setAssets(data.assets || []))
      .catch(() => setError('Assets laden is mislukt.'))
  }, [isOpen])

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          assetType,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Afbeelding genereren is mislukt.')
        return
      }

      setAssets(prev => [{
        id: data.id,
        prompt: data.prompt,
        assetType,
        url: data.url,
        timestamp: data.timestamp,
      }, ...prev])
      setPrompt('')
    } catch {
      setError('Afbeelding genereren is mislukt.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyUrl = async (asset: Asset) => {
    const fullUrl = `${window.location.origin}${asset.url}`
    await navigator.clipboard.writeText(fullUrl)
    setCopiedId(asset.id)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#161616] shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#111111] p-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-[#F9CD00]" />
            <h2 className="font-display text-2xl font-black leading-none text-white">ASSET BIBLIOTHEEK</h2>
          </div>
          <button onClick={onClose} className="focus-ring rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white" title="Sluiten">
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/10 bg-[#111111]/65 p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/65">Wat wil je maken?</label>
              <div className="flex flex-wrap gap-2">
                {ASSET_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setAssetType(type.value)}
                    className={`focus-ring rounded-md px-3 py-1.5 text-xs font-semibold transition active:translate-y-px ${
                      assetType === type.value
                        ? 'bg-[#F9CD00] text-black'
                        : 'border border-white/10 bg-[#161616] text-white/55 hover:text-white'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Beschrijf je asset, bijvoorbeeld: blauwe ruimteraket"
                className="focus-ring min-w-0 flex-1 rounded-md border border-white/10 bg-black/35 px-4 py-2 text-sm text-white placeholder:text-white/25"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="focus-ring flex items-center justify-center gap-2 rounded-md bg-[#DD084B] px-5 py-2 font-semibold text-white transition hover:bg-[#B8063F] active:translate-y-px disabled:opacity-45"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? 'Maken...' : 'Genereer'}
              </button>
            </div>

            {error && (
              <div className="rounded-md border border-[#DD084B]/40 bg-[#DD084B]/10 px-3 py-2 text-sm text-white">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {assets.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-white/12 bg-black/18 text-center">
              <ImageIcon className="mb-3 h-10 w-10 text-white/25" />
              <p className="text-white/65">Nog geen assets</p>
              <p className="mt-1 text-sm text-white/35">Maak een item, karakter, achtergrond of icon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {assets.map(asset => (
                <div key={asset.id} className="overflow-hidden rounded-md border border-white/10 bg-[#111111]">
                  <div className="relative aspect-square bg-black/35">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={asset.prompt} className="h-full w-full object-contain" />
                  </div>
                  <div className="space-y-2 p-2">
                    <p className="truncate text-xs text-white/45">{asset.prompt}</p>
                    <button
                      onClick={() => handleCopyUrl(asset)}
                      className="focus-ring flex w-full items-center justify-center gap-1 rounded bg-white/8 px-2 py-1.5 text-xs text-white/70 transition hover:bg-white/12 hover:text-white"
                    >
                      {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === asset.id ? 'Gekopieerd' : 'Kopieer URL'}
                    </button>
                    {onUseInChat && (
                      <button
                        onClick={() => { onUseInChat(asset.prompt); onClose() }}
                        className="focus-ring flex w-full items-center justify-center gap-1 rounded border border-[#F9CD00]/25 bg-[#F9CD00]/10 px-2 py-1.5 text-xs text-[#F9CD00] transition hover:bg-[#F9CD00]/16"
                      >
                        <MessageSquarePlus size={12} />
                        Gebruik in chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
