import { test, expect } from '@playwright/test';

const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const captureUi = async (page, path) => {
  // SwiftShader can take longer than Playwright's action timeout to read back a
  // continuously-rendering WebGL canvas. Showroom tests cover the rendered
  // vehicles; these snapshots are evidence for the DOM HUD and touch layout.
  await page.locator('canvas').evaluate(canvas => { canvas.style.visibility = 'hidden'; });
  await page.screenshot({ path, timeout: 30000 });
  await page.locator('canvas').evaluate(canvas => { canvas.style.visibility = ''; });
};
for (const [name, width, height] of [['small', 320, 568], ['portrait', 390, 844], ['landscape', 844, 390], ['tablet', 820, 1180]]) {
  test(`${name}: touch controls, readable HUD and no keyboard-only instructions`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await context.grantPermissions(['accelerometer', 'gyroscope']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // This suite validates DOM HUD/control behavior. The showroom suite owns
    // real WebGL output checks, so avoid competing with SwiftShader here.
    await page.goto('/?debug=1&ui-test=1');
    await expect(page.locator('#loading')).toBeHidden({ timeout: 60000 });
    // The test panel is not product UI and must not obscure touch targets.
    await page.locator('#debug-panel').evaluate(node => node.classList.add('hidden'));
    for (const hint of await page.locator('.keyboard-only').all()) await expect(hint).toBeHidden();
    await page.getByText('DRIVER CONTROLS', { exact: true }).click();
    await expect(page.locator('.controls-grid')).toBeHidden();
    await expect(page.locator('.mobile-controls-guide')).toBeVisible();
    await page.getByRole('button', { name: 'START RUN' }).click();
    // Keep traffic from ending a run while the UI assertions inspect its layout.
    await page.locator('[data-debug-action="auto"]').dispatchEvent('click');
    await expect(page.locator('#mobile-controls')).toHaveClass(/active/);
    const selectors = ['.hud-top-left', '.hud-top-center', '.hud-bottom-right', '.mobile-secondary-controls', '.mobile-steering', '.mobile-pedals'];
    const boxes = [];
    for (const selector of selectors) {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      expect(box.x, selector).toBeGreaterThanOrEqual(0);
      expect(box.y, selector).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, selector).toBeLessThanOrEqual(width);
      expect(box.y + box.height, selector).toBeLessThanOrEqual(height);
      boxes.push(box);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j]), `${selectors[i]} overlaps ${selectors[j]}`).toBe(false);
    for (const button of await page.locator('#mobile-controls button:visible').all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await captureUi(page, info.outputPath('driving.png'));
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await expect(page.locator('#pause')).toBeVisible();
    await expect(page.locator('#pause .keyboard-only')).toBeHidden();
    await expect(page.locator('#pause .touch-only')).toBeVisible();
    await page.getByRole('button', { name: 'MUTE AUDIO', exact: true }).click();
    await expect(page.locator('#pause-mute')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'RESUME RUN' }).click();
    await expect(page.locator('#mobile-controls')).toHaveClass(/active/);
    // Exercise simultaneous real pointer events, including cancellation of held controls.
    const steer = page.locator('[data-mobile-control="left"]');
    const gas = page.locator('[data-mobile-control="throttle"]');
    const cdp = await context.newCDPSession(page);
    const a = await steer.boundingBox(), b = await gas.boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { id: 10, x: a.x + a.width / 2, y: a.y + a.height / 2 },
      { id: 11, x: b.x + b.width / 2, y: b.y + b.height / 2 },
    ] });
    await expect(steer).toHaveClass(/is-pressed/); await expect(gas).toHaveClass(/is-pressed/);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(steer).not.toHaveClass(/is-pressed/); await expect(gas).not.toHaveClass(/is-pressed/);
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await page.getByRole('button', { name: 'QUIT TO TITLE' }).click();
    await page.locator('#mobile-control-mode').selectOption('tilt');
    await page.getByRole('button', { name: 'START RUN' }).click();
    await page.locator('[data-debug-action="auto"]').dispatchEvent('click');
    await expect(page.locator('.mobile-steering')).toBeHidden();
    await expect(page.locator('.mobile-tilt-actions')).toBeVisible();
    await expect(page.locator('#mobile-calibrate')).toBeVisible();
    const tiltBoxes = [];
    for (const button of await page.locator('#mobile-controls button:visible').all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(height);
      tiltBoxes.push(box);
    }
    for (let i = 0; i < tiltBoxes.length; i++) for (let j = i + 1; j < tiltBoxes.length; j++) expect(overlaps(tiltBoxes[i], tiltBoxes[j])).toBe(false);
    await captureUi(page, info.outputPath('tilt.png'));
    expect(errors).toEqual([]);
    await context.close();
  });
}
