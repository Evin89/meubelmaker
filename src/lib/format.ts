export const mm = (n: number) => (Math.round(n * 10) / 10).toLocaleString('nl-NL')
export const m2 = (mm2: number) => (mm2 / 1e6).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const parseNum = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'meubel'

/** Start een download van tekst in de browser. */
export function download(filename: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Houtkleur per plaatdikte: dikker = donkerder. */
export function woodHsl(t: number): [number, number, number] {
  return [33, 52, Math.max(42, 80 - t * 1.1)]
}
export const woodCss = (t: number) => {
  const [h, s, l] = woodHsl(t)
  return `hsl(${h} ${s}% ${l}%)`
}
