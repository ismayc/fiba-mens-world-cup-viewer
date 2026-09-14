// Rebuild public/og-image.png, the link-preview card.
//
//   npm run og:image
//
// Needs ImageMagick 7 (`magick`) on PATH and the system Arial faces. Font paths
// are macOS ones; on Linux point BOLD/REG at any grotesque you have.
//
// WHY THIS CARD DOES NOT SHOW THE DRAW. The women's sibling's card listed all
// sixteen nations in their four groups. This edition's draw HAS NOT HAPPENED (only
// Qatar and Türkiye have qualified as of late 2026), so there is no real field to
// show; a placeholder grid on a share card would read as a real draw. The card is
// therefore a clean summary of the tournament and the tool, with a plain note that
// the draw is still to come.
//
// WHY THE WORDING IS NOT IN THE SVG. Two ImageMagick limits force it:
//   1. Its SVG renderer has NO FONT STACK. Any <text> element fails with "unable
//      to read font" and ABORTS the command, leaving the PREVIOUS og-image.png in
//      place, so the build looks successful while the card still says the old
//      thing. Everything textual is drawn with -annotate against explicit font
//      FILES, which always resolve.
//   2. It paints a `fill="url(#gradient)"` reference PURE BLACK, so
//      public/og-image.svg uses flat fills only.
//
// Node built-ins only, like every other script here.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
const REG = '/System/Library/Fonts/Supplemental/Arial.ttf'

const magick = (args) => execFileSync('magick', args, { encoding: 'utf8' })

function main() {
  const work = mkdtempSync(join(tmpdir(), 'og-'))
  try {
    // Artwork layer: dark ground, maroon top bar, rules and the ball badge.
    const layer = join(work, 'layer.png')
    magick(['-background', 'none', join(ROOT, 'public/og-image.svg'), '-resize', '1200x630', layer])

    const args = [
      layer,
      // Title + subtitle, to the right of the badge.
      '-font', BOLD, '-pointsize', '50', '-fill', '#ffffff',
      '-annotate', '+200+118', 'FIBA Men’s World Cup 2027',
      '-font', REG, '-pointsize', '27', '-fill', '#e56f88',
      '-annotate', '+202+166', 'Schedule Viewer · Doha, Qatar',
      // Three headline facts across the middle.
      '-font', BOLD, '-pointsize', '40', '-fill', '#ffffff',
      '-annotate', '+60+320', '32 teams   ·   92 games   ·   two group stages',
      '-font', REG, '-pointsize', '30', '-fill', '#a7adb8',
      '-annotate', '+60+380', '27 August – 12 September 2027',
      // The honest caveat.
      '-font', BOLD, '-pointsize', '24', '-fill', '#e56f88',
      '-annotate', '+60+452', 'Provisional — the 32-team draw is held in spring 2027',
      // Footer.
      '-font', REG, '-pointsize', '24', '-fill', '#a7adb8',
      '-annotate', '+60+606',
      'group standings · the knockout bracket · in your timezone',
      join(ROOT, 'public/og-image.png'),
    ]
    magick(args)

    // Verify. All three of these have caught a silently-broken card in this family.
    const out = magick([
      join(ROOT, 'public/og-image.png'),
      '-format', '%w %h %[pixel:p{1140,300}] %[fx:standard_deviation]', 'info:',
    ]).trim()
    const [w, h, ground, sd] = out.split(' ')
    console.log(`og-image.png: ${w}x${h} ground=${ground} stddev=${sd}`)
    if (w !== '1200' || h !== '630') throw new Error(`wrong size ${w}x${h}`)
    if (!ground.includes('21,23,27')) {
      throw new Error(`ground is ${ground}, not #15171b. Did a gradient rasterize to black?`)
    }
    if (Number(sd) < 0.02) throw new Error('image is nearly blank')
    console.log('OK')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

main()
