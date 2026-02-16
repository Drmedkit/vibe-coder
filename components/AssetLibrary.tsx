'use client'

import { useState } from 'react'
import { X, Loader2, Image as ImageIcon, Sparkles, Copy, Check } from 'lucide-react'

interface Asset {
  id: string
  prompt: string
  url: string
  timestamp: number
}

interface AssetLibraryProps {
  isOpen: boolean
  onClose: () => void
}

export function AssetLibrary({ isOpen, onClose }: AssetLibraryProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [assetType, setAssetType] = useState<'character' | 'background' | 'item' | 'icon'>('item')

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          assetType
        })
      })

      const data = await response.json()

      if (data.error) {
        alert(data.error)
        return
      }

      const newAsset: Asset = {
        id: data.id || `asset-${Date.now()}`,
        prompt: prompt.trim(),
        url: data.url,
        timestamp: Date.now()
      }

      setAssets(prev => [newAsset, ...prev])
      setPrompt('')
    } catch (error) {
      console.error('Failed to generate image:', error)
      alert('Er ging iets mis bij het genereren van de afbeelding.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyUrl = (asset: Asset) => {
    navigator.clipboard.writeText(asset.url)
    setCopiedId(asset.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Asset Bibliotheek</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-md transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Generator Section */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Wat wil je maken?
              </label>
              <div className="flex gap-2 mb-3">
                {(['item', 'character', 'background', 'icon'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAssetType(type)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      assetType === type
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {type === 'item' && 'Item'}
                    {type === 'character' && 'Karakter'}
                    {type === 'background' && 'Achtergrond'}
                    {type === 'icon' && 'Icon'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Beschrijf je asset... (bijv. 'rode appel', 'blauwe ruimteraket')"
                className="flex-1 bg-gray-800 text-gray-100 text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-6 py-2 transition-colors flex items-center gap-2 font-medium"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Maken...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Genereer
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Tip: Beschrijf wat je wilt zien, de AI maakt er een game asset van!
            </p>
          </div>
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {assets.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>Nog geen assets gegenereerd.</p>
              <p className="text-sm mt-1">Beschrijf wat je wilt maken en klik op Genereer!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors group"
                >
                  <div className="aspect-square bg-gray-900 relative">
                    <img
                      src={asset.url}
                      alt={asset.prompt}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-400 truncate mb-2">{asset.prompt}</p>
                    <button
                      onClick={() => handleCopyUrl(asset)}
                      className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      {copiedId === asset.id ? (
                        <>
                          <Check size={12} />
                          Gekopieerd!
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          Kopieer URL
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <p className="text-xs text-gray-500 text-center">
            Gebruik de gekopieerde URL in je HTML: <code className="bg-gray-800 px-1 rounded">&lt;img src=&quot;URL&quot;&gt;</code>
          </p>
        </div>
      </div>
    </div>
  )
}
