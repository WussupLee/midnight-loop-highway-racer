import { describe, expect, it } from 'vitest';
import { resolveMusicUrl } from '../src/game/audio';

describe('hosted music path', () => {
  it('keeps the soundtrack inside a GitHub Pages repository subpath', () => {
    expect(resolveMusicUrl('https://wussuplee.github.io/midnight-loop-highway-racer/'))
      .toBe('https://wussuplee.github.io/midnight-loop-highway-racer/audio/midnight-loop-background.mp3');
  });

  it('also resolves correctly from the local development root', () => {
    expect(resolveMusicUrl('http://127.0.0.1:4175/'))
      .toBe('http://127.0.0.1:4175/audio/midnight-loop-background.mp3');
  });
});
