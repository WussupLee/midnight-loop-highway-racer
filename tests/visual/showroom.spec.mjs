import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { writeFile } from 'node:fs/promises';
import { measurePixels, qualityFailures } from './metrics';

const decode = url => PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));

for (const [name, width, height, touch] of [
  ['desktop', 1440, 900, false], ['phone', 390, 844, true],
  ['small-phone', 320, 568, true], ['landscape', 844, 390, true],
]) {
  test(`${name}: every catalog vehicle remains framed and visible through 360 degrees`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('/?visual-test=1');
    await expect(page.locator('#loading')).toBeHidden({ timeout: 60000 });
    const cars = await page.evaluate(() => window.__SHOWROOM_TEST__.cars);
    test.setTimeout(60000 + cars.length * 120000);
    expect(cars.length).toBeGreaterThan(0);
    const measurements = [];
    for (const car of cars) {
      for (let angle = 0; angle < 360; angle += 45) {
        const sample = await page.evaluate(({ id, yaw }) => window.__SHOWROOM_TEST__.capture(id, yaw), { id: car.id, yaw: angle * Math.PI / 180 });
        const metrics = measurePixels(decode(sample.foreground), decode(sample.background), decode(sample.mask), sample.rect, sample.viewport);
        measurements.push({ car: car.id, angle, ...metrics });
        const label = `${car.id} at ${angle}°: ${JSON.stringify(metrics)}`;
        await info.attach(`${car.id}-${angle}`, { body: Buffer.from(sample.foreground.split(',')[1], 'base64'), contentType: 'image/png' });
        if (angle === 0) await writeFile(info.outputPath(`${car.id}-render.png`), Buffer.from(sample.foreground.split(',')[1], 'base64'));
        expect(sample.fallback, 'Imported car must load; a loan car cannot pass').toBe(false);
        expect.soft(qualityFailures(metrics, sample.rect, height), label).toEqual([]);
      }
      await page.screenshot({ path: info.outputPath(`${car.id}-menu.png`) });
    }
    await writeFile(info.outputPath('measurements.json'), JSON.stringify(measurements, null, 2));
    await info.attach('measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
    await context.close();
  });
}
