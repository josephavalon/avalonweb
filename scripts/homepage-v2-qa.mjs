import { chromium } from 'playwright';

const BASE_URL = process.env.HOMEPAGE_V2_QA_BASE_URL
  || `http://127.0.0.1:${process.env.CONDUCTOR_PORT || '4173'}`;
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTHS = [320, 375, 390, 414, 768, 1024, 1440];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      deviceScaleFactor: width < 768 ? 2 : 1,
    });
    const page = await context.newPage();
    const issues = [];
    page.on('console', (message) => {
      const text = message.text();
      const ignorableThirdPartyPreload = text.includes('cognitoforms.com/f/seamless.js')
        && text.includes('was preloaded using link preload but not used');
      if (['error', 'warning'].includes(message.type()) && !ignorableThirdPartyPreload) issues.push(text);
    });
    page.on('pageerror', (error) => issues.push(error.message));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('cookieConsent', 'allowed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1300);

    assert(await page.locator('.home-v2').isVisible(), `homepage-v2 missing at ${width}px`);
    const pressPlacement = await page.evaluate(() => {
      const rail = document.querySelector('.nd-press')?.getBoundingClientRect();
      return rail ? { top: rail.top, bottom: rail.bottom, viewport: window.innerHeight } : null;
    });
    assert(pressPlacement, `trusted-by feed missing at ${width}px`);
    assert(
      Math.abs(pressPlacement.bottom - pressPlacement.viewport) <= 2,
      `trusted-by feed ends at ${pressPlacement.bottom}px instead of the ${pressPlacement.viewport}px viewport bottom at ${width}px`,
    );
    assert(await page.locator('.home-v2__therapy-card').count() === 3, `expected three featured therapy cards at ${width}px`);
    const therapyImagesLoaded = await page.locator('.home-v2__therapy-visual img').evaluateAll((images) => (
      images.length === 3 && images.every((image) => image.complete && image.naturalWidth > 0)
    ));
    assert(therapyImagesLoaded, `expected three loaded therapy previews at ${width}px`);
    assert(await page.getByRole('heading', { name: 'Explore therapies' }).isVisible(), `therapy heading missing at ${width}px`);
    assert(await page.getByText('Founder pricing from $175.').isVisible(), `founder pricing missing at ${width}px`);
    const cardText = await page.locator('.home-v2__therapy-card').allTextContents();
    assert(cardText[0]?.includes('$200') && cardText[0]?.includes('$175'), `Hydration pricing is incorrect at ${width}px`);
    assert(cardText[1]?.includes('$285') && cardText[1]?.includes('$195'), `Myers pricing is incorrect at ${width}px`);
    assert(cardText[2]?.includes('$285') && cardText[2]?.includes('$195'), `Hangover pricing is incorrect at ${width}px`);
    assert(!(await page.getByRole('heading', { name: /Clinician led\. Nurse delivered\./i }).count()), `removed clinician-care module is still present at ${width}px`);
    assert(!(await page.getByText(/Clinical content reviewed/i).count()), `internal review date exposed at ${width}px`);
    assert(await page.getByRole('heading', { name: 'Find your starting point' }).isVisible(), `picker missing at ${width}px`);
    assert(await page.getByText('Five Bay Area counties.').isVisible(), `service-area copy missing at ${width}px`);
    assert(await page.getByText('Service counties').isVisible(), `interactive service map missing at ${width}px`);
    assert(await page.getByRole('button', { name: /^Explore .* County$/ }).count() === 5, `expected exactly five service counties at ${width}px`);
    assert(!(await page.getByRole('button', { name: /Explore (Marin|Napa|Sonoma|Solano) County/ }).count()), `out-of-region county leaked into map at ${width}px`);
    assert(await page.locator('#home-v2-coverage').getAttribute('role') === 'combobox', `address autocomplete missing at ${width}px`);

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ) - window.innerWidth);
    assert(overflow <= 2, `horizontal overflow ${overflow}px at ${width}px`);

    if (width < 768) {
      assert(!(await page.locator('.av-cookie-control').isVisible()), `cookie FAB covers mobile content at ${width}px`);
      const utilityCta = page.getByRole('link', { name: 'Start your visit' });
      const box = await utilityCta.boundingBox();
      assert(box && box.height >= 44, `utility CTA is ${box?.height || 0}px high at ${width}px`);
      const mobileLayout = await page.evaluate(() => {
        const paths = document.querySelector('.nd-hero__paths')?.getBoundingClientRect();
        const press = document.querySelector('.nd-press')?.getBoundingClientRect();
        const banner = document.querySelector('.nd-safari-tint-bar')?.getBoundingClientRect();
        const underline = document.querySelector('.nd-safari-tint-bar a > span')?.getBoundingClientRect();
        const headings = [...document.querySelectorAll(
          '.home-v2__menu-head h2, .home-v2__picker-copy h2, .home-v2__area-copy h2, .home-v2__final-cta h2',
        )].map((heading) => {
          const rect = heading.getBoundingClientRect();
          const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
          return { height: rect.height, lineHeight };
        });
        return {
          actionOverlap: paths && press ? paths.bottom - press.top : 0,
          bannerOverflow: document.querySelector('.nd-safari-tint-bar')?.scrollWidth - window.innerWidth,
          underlineGap: banner && underline ? banner.bottom - underline.bottom : 0,
          headings,
        };
      });
      assert(mobileLayout.actionOverlap <= 0, `hero actions overlap the trusted-by rail by ${mobileLayout.actionOverlap}px at ${width}px`);
      assert(mobileLayout.bannerOverflow <= 0, `founder banner overflows by ${mobileLayout.bannerOverflow}px at ${width}px`);
      assert(
        mobileLayout.underlineGap >= 4 && mobileLayout.underlineGap <= 20,
        `utility CTA underline is ${mobileLayout.underlineGap}px from the banner edge at ${width}px`,
      );
      assert(
        mobileLayout.headings.every(({ height, lineHeight }) => height <= lineHeight * 1.15),
        `homepage module heading wrapped at ${width}px`,
      );
    }

    assert(!await page.locator('.vite-error-overlay').count(), `Vite error overlay at ${width}px`);
    assert(issues.length === 0, `console issues at ${width}px: ${issues.join(' | ')}`);
    if (width === 390 || width === 1440) {
      await page.locator('.home-v2__area').scrollIntoViewIfNeeded();
      const mapLoaded = await page.locator('.home-v2__map-viewport > img').evaluate(async (image) => {
        if (!image.complete) await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }));
        if (image.decode) await image.decode().catch(() => {});
        return image.naturalWidth > 0;
      });
      assert(mapLoaded, `service-area map image missing at ${width}px`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `.context/homepage-v2-${width}.png`, fullPage: true });
    }
    await context.close();
  }

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const oversized = await page.locator('.home-v2__section, .home-v2__closing').evaluateAll((sections) => sections
      .map((section) => ({
        name: section.className,
        height: Math.ceil(section.getBoundingClientRect().height),
      }))
      .filter((section) => section.height > window.innerHeight + 2));
    assert(
      oversized.length === 0,
      `desktop modules exceed ${viewport.width}x${viewport.height}: ${JSON.stringify(oversized)}`,
    );
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('cookieConsent', 'allowed'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Rehydrate' }).click();
  await page.getByRole('button', { name: 'Today' }).click({ force: true });
  await page.getByRole('button', { name: 'Home' }).click({ force: true });
  assert(await page.getByRole('heading', { name: 'Hydration IV' }).isVisible(), 'picker result did not resolve to Hydration IV');
  const resultHref = await page.locator('.home-v2__picker-result').getByRole('link', { name: /^Start$/ }).getAttribute('href');
  assert(resultHref?.includes('therapy=hydration'), 'picker result did not prefill therapy');
  assert(resultHref?.includes('goal=hydration'), 'picker result did not preserve the selected goal');
  assert(resultHref?.includes('timing=today'), 'picker result did not prefill timing');
  assert(resultHref?.includes('location=home'), 'picker result did not prefill location');
  await context.close();

  const areaContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const areaPage = await areaContext.newPage();
  await areaPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await areaPage.evaluate(() => localStorage.setItem('cookieConsent', 'allowed'));
  await areaPage.reload({ waitUntil: 'domcontentloaded' });
  await areaPage.locator('.home-v2__picker').screenshot({ path: '.context/homepage-v2-picker-1440.png' });
  await areaPage.locator('.home-v2__area').screenshot({ path: '.context/homepage-v2-service-area.png' });
  await areaPage.locator('#home-v2-coverage').fill('94107');
  await areaPage.getByRole('button', { name: 'Check' }).click();
  assert(await areaPage.getByText('Covered: San Francisco.').isVisible(), 'covered ZIP did not resolve to San Francisco');
  assert(await areaPage.locator('.home-v2__map-focus').isVisible(), 'covered ZIP did not animate to a focused map state');
  await areaPage.waitForTimeout(950);
  const coveredMapTransform = await areaPage.locator('.home-v2__map-viewport > img').evaluate((image) => getComputedStyle(image).transform);
  assert(coveredMapTransform !== 'none' && !coveredMapTransform.includes('matrix(1, 0, 0, 1'), 'covered ZIP did not zoom the map image');
  await areaPage.locator('.home-v2__area').screenshot({ path: '.context/homepage-v2-service-area-covered.png' });
  await areaPage.locator('#home-v2-coverage').fill('90210');
  await areaPage.getByRole('button', { name: 'Check' }).click();
  assert(await areaPage.getByText('Coverage check needed.').isVisible(), 'outside ZIP did not provide manual coverage guidance');
  assert(!(await areaPage.locator('.home-v2__map-focus').count()), 'outside ZIP should reset the focused map state');
  await areaPage.getByRole('button', { name: 'Explore Alameda County' }).click();
  const alamedaCities = await areaPage.locator('.home-v2__map-focus').innerText();
  assert(alamedaCities.includes('Oakland') && alamedaCities.includes('Union City'), 'county detail did not expose the complete Alameda city list');
  await areaContext.close();

  console.log(`Homepage v2 QA passed ${WIDTHS.length} viewports, the guided picker, and service-area map states.`);
} finally {
  await browser.close();
}
