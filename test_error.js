import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:5173');
    // Wait for load
    await new Promise(r => setTimeout(r, 2000));

    // create an image layer to test
    await page.evaluate(async () => {
        // try to get zustand store
        const store = window.__ZUSTAND_STORE__ || null;

        // Fallback: click add image button if it exists
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Layer'));
        if (btn) btn.click();

        await new Promise(r => setTimeout(r, 500));

        // click add effect
        const btn2 = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Effect'));
        if (btn2) btn2.click();

        await new Promise(r => setTimeout(r, 500));

        // click ASCII Art
        const btn3 = Array.from(document.querySelectorAll('div[role="menuitem"]')).find(b => b.textContent.includes('ASCII Art'));
        if (btn3) btn3.click();

        console.log("Clicked ASCII");
    });

    await new Promise(r => setTimeout(r, 2000));

    // output the full HTML so I can see if the error boundary triggered
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("BODY START\n" + html.substring(0, 1000) + "\nBODY END");

    await browser.close();
})();
