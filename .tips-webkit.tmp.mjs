import { webkit } from 'playwright'
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('console error', m.text()) })
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto('http://localhost:5173/objects/sun')
await page.waitForSelector('#welcome-tile:not([hidden])', { timeout: 30000 }).catch(() => console.log('no welcome'))
await page.click('#welcome-no').catch(() => {})
const t0 = Date.now(), at = () => Math.round((Date.now() - t0) / 1000) + 's'
const actions = ['close', 'show', 'ignore', 'close', 'show', 'close', 'show', 'close', 'ignore', 'close', 'show', 'close']
let n = 0, lastTip = null
while (Date.now() - t0 < 330_000 && n < actions.length) {
  const tip = await page.evaluate(() => document.getElementById('tip-tile').hidden ? null : document.getElementById('tip-text').textContent)
  if (tip && tip !== lastTip) {
    const action = actions[n++]
    console.log(at(), 'TIP', JSON.stringify(tip), '->', action)
    await page.waitForTimeout(1500)
    if (action === 'close') await page.click('#tip-close')
    if (action === 'show') {
      const visible = await page.isVisible('#tip-show')
      if (!visible) { console.log('   no Show me; closing'); await page.click('#tip-close') }
      else {
        await page.click('#tip-show')
        await page.waitForTimeout(2500)
        const tut = await page.$('.tutorial-tile')
        console.log('   tutorial tile', !!tut)
        // Quit via the visible button (quit, or next on a single step).
        const btn = await page.$('.tutorial-tile .tutorial-quit:not([hidden])') ?? await page.$('.tutorial-tile button:last-of-type')
        if (btn) await btn.click().catch((e) => console.log('   click fail', e.message.split('\n')[0]))
        await page.waitForTimeout(500)
        console.log('   after quit: tutorial tile', !!(await page.$('.tutorial-tile')))
      }
    }
    await page.mouse.move(700, 600)
  }
  lastTip = tip
  await page.waitForTimeout(1000)
}
console.log(at(), 'done; tips seen', n)
console.log(await page.evaluate(() => JSON.stringify({ tutorial: !!document.querySelector('.tutorial-tile'), visibility: document.visibilityState, tipHidden: document.getElementById('tip-tile').hidden, stored: Object.fromEntries(Object.keys(localStorage).filter(k => /tip/.test(k)).map(k => [k, localStorage[k]])) })))
await browser.close()
