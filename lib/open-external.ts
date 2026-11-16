// The installed Desk keeps ordinary links inside the app. On Android we can
// ask Chrome itself to open the page through an intent URL; if Chrome is not
// there, the intent falls back to the plain URL. Other platforms (iOS) give
// web apps no way to force this, so they keep the normal link behavior.
export function androidChromeIntent(url: string): string | null {
  if (typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent))
    return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const scheme = u.protocol.slice(0, -1)
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}
