import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log(`[BROWSER ERROR] ${error.message}`);
  });

  console.log("Navigating to app...");
  await page.goto('http://localhost:5173');
  
  // Wait for the UI to load
  await page.waitForTimeout(2000);
  
  console.log("Mocking image upload...");
  // Find the file input and set a generic 1x1 base64 GIF 
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
      await fileInput.setInputFiles({
          name: 'test.png',
          mimeType: 'image/png',
          buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkCgAAFAADKpeHmwAAAABJRU5ErkJggg==', 'base64')
      });
  } else {
     // Alternatively just click the plus button on the layer panel and select image layer
     // Wait, the add image layer button
     console.log("Clicking + button");
     const plusBtns = await page.$$('button:has(svg.lucide-plus)');
     // The second one is in the Effects Panel, the first one is Layer Panel
     await plusBtns[0].click();
     await page.waitForTimeout(500);
     
     console.log("Clicking Image Layer");
     // The dropdown contains "Image Layer"
     const items = await page.$$('div[role="menuitem"]');
     for (const item of items) {
         const text = await item.textContent();
         if (text && text.toLowerCase().includes('image')) {
             await item.click();
             break;
         }
     }
  }

  await page.waitForTimeout(1000);

  console.log("Clicking + button on Effects Panel");
  const plusBtns2 = await page.$$('button:has(svg.lucide-plus)');
  await plusBtns2[1].click(); // second plus button is effects
  await page.waitForTimeout(500);

  console.log("Clicking Brightness & Contrast");
  const items2 = await page.$$('div[role="menuitem"]');
  for (const item of items2) {
      const text = await item.textContent();
      if (text && text.toLowerCase().includes('brightness')) {
          await item.click();
          break;
      }
  }

  await page.waitForTimeout(1000);
  console.log("Capturing canvas pixels...");
  
  const canvas = await page.$('canvas');
  if (canvas) {
      const dataUrl = await page.evaluate(c => c.toDataURL(), canvas);
      console.log(`Canvas outputs data url: ${dataUrl.substring(0, 50)}...`);
  }

  await browser.close();
})();
