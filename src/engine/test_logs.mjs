import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const EFFECT_LABELS = [
  'Brightness & Contrast',
  'Black & White',
  'Levels',
  'Curves',
  'Selective Color',
  'Unsharp Mask',
  'Add Noise',
  'Ripple',
  'Minimum (Erode)',
  'Find Edges',
];

const STATE_SUFFIXES = ['default', 'middle', 'extreme'];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function setNumericInputs(card, mode) {
  const inputs = card.locator('input[type="number"]');
  const count = await inputs.count();

  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    const minRaw = await input.getAttribute('min');
    const maxRaw = await input.getAttribute('max');
    const stepRaw = await input.getAttribute('step');

    const min = Number(minRaw ?? 0);
    const max = Number(maxRaw ?? min + 1);
    const step = Number(stepRaw ?? 1);

    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

    let target = min;
    if (mode === 'middle') target = (min + max) * 0.5;
    if (mode === 'extreme') target = max;

    const precision = Number.isFinite(step) && step > 0 && step < 1
      ? Math.min(4, Math.max(0, String(step).split('.')[1]?.length ?? 0))
      : 0;

    const rounded = Number(target.toFixed(precision));

    await input.evaluate((el, value) => {
      const element = el;
      element.value = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, rounded);
  }
}

async function addEffect(page, label) {
  await page.getByRole('button', { name: /Add Effect/i }).click();
  const menuItem = page.getByRole('menuitem').filter({ hasText: label }).first();
  await menuItem.click();
}

async function getNewestEffectCard(page) {
  const cards = page.locator('div.relative.flex.flex-col.border-b');
  const count = await cards.count();
  if (count === 0) return null;
  return cards.nth(count - 1);
}

(async () => {
  const outputDir = path.resolve(process.cwd(), 'dist/effects-captures');
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (error) => {
    console.log(`[browser:error] ${error.message}`);
  });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1200);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAABYElEQVR42u3BMQEAAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G4B2QABByi8oQAAAABJRU5ErkJggg==', 'base64')
  });

  await page.waitForTimeout(600);

  const canvas = page.locator('canvas').first();

  for (const label of EFFECT_LABELS) {
    console.log(`Capturing ${label}`);

    await addEffect(page, label);
    await page.waitForTimeout(250);

    const card = await getNewestEffectCard(page);
    if (!card) {
      console.log(`No card found for ${label}`);
      continue;
    }

    for (const state of STATE_SUFFIXES) {
      if (state !== 'default') {
        await setNumericInputs(card, state);
        await page.waitForTimeout(200);
      }

      const fileName = `${slugify(label)}-${state}.png`;
      const filePath = path.join(outputDir, fileName);
      await canvas.screenshot({ path: filePath });
      console.log(`Saved ${filePath}`);
    }

    const deleteBtn = card.locator('button:has(svg.lucide-trash2)').first();
    if (await deleteBtn.count()) {
      await deleteBtn.click();
      await page.waitForTimeout(200);
    }
  }

  await browser.close();
  console.log(`Completed captures in ${outputDir}`);
})();
