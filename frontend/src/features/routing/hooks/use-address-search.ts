import { useState, useRef, useCallback } from 'react'
import { NOMINATIM_SEARCH_URL } from '@/constants/config'

export type AddressResult = {
  label: string
  coords: [number, number]
}

export function useAddressSearch(userLocation?: [number, number] | null) {
  const [results, setResults]   = useState<AddressResult[]>([])
  const [loading, setLoading]   = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.trim().length < 3) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        // Bias results toward user's location using a viewbox (±0.15° ≈ 15 km)
        const proximity = userLocation
          ? `&viewbox=${userLocation[0] - 0.15},${userLocation[1] - 0.15},${userLocation[0] + 0.15},${userLocation[1] + 0.15}&bounded=0`
          : ''
        const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=0&accept-language=fr${proximity}`
        const res  = await fetch(url, { headers: { 'User-Agent': 'InvaderHunter/1.0' } })
        const data = await res.json() as { display_name: string; lon: string; lat: string }[]
        const mapped = data.map((item) => ({
          label:  item.display_name,
          coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
        }))
        if (userLocation) {
          const [ulon, ulat] = userLocation
          mapped.sort((a, b) => {
            const da = (a.coords[1] - ulat) ** 2 + (a.coords[0] - ulon) ** 2
            const db = (b.coords[1] - ulat) ** 2 + (b.coords[0] - ulon) ** 2
            return da - db
          })
        }
        setResults(mapped)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [userLocation?.[0], userLocation?.[1]])

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])
  }, [])

  return { search, results, loading, clear }
}
