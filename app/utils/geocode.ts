const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'AmsterdamParentProject/1.0 (amsterdamparentproject@gmail.com)'

export interface Coordinates {
  latitude: number
  longitude: number
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (!address?.trim()) return null
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      // Skip Next.js cache — always fetch fresh
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    }
  } catch {
    return null
  }
}
