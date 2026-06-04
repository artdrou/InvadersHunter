import { useState, useRef, useCallback } from 'react'

export type AddressResult = {
  label: string
  coords: [number, number]
}

export function useAddressSearch() {
  const [results, setResults]   = useState<AddressResult[]>([])
  const [loading, setLoading]   = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.trim().length < 3) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=0&accept-language=fr`
        const res  = await fetch(url, { headers: { 'User-Agent': 'InvaderHunter/1.0' } })
        const data = await res.json() as Array<{ display_name: string; lon: string; lat: string }>
        setResults(
          data.map((item) => ({
            label:  item.display_name,
            coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
          })),
        )
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [])

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])
  }, [])

  return { search, results, loading, clear }
}
