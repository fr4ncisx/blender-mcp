import { SocialRoomPalette } from '../entities/social-room.entity.js';

export class ThemeSynthesizer {
  private static readonly PRESETS: Readonly<Record<string, SocialRoomPalette>> = Object.freeze({
    luxury_lounge: Object.freeze({
      floorLight: '#e9ecef',
      floorDark: '#cfd8dc',
      wallColor: '#1a2634',
      wallTrim: '#c5a059',
      accentColor: '#a0522d',
      secondaryAccent: '#1b4332',
      metalAccent: '#d4af37',
      woodAccent: '#3e2723'
    }),
    art_deco_cyberpunk: Object.freeze({
      floorLight: '#1a1a1a',
      floorDark: '#05472a',
      wallColor: '#1a1a1a',
      wallTrim: '#d4af37',
      accentColor: '#ff007f',
      secondaryAccent: '#00f0ff',
      metalAccent: '#d4af37',
      woodAccent: '#1a1a1a'
    }),
    cyberpunk_club: Object.freeze({
      floorLight: '#1f242d',
      floorDark: '#0f141c',
      wallColor: '#0d1117',
      wallTrim: '#00f5d4',
      accentColor: '#ff007f',
      secondaryAccent: '#7928ca',
      metalAccent: '#00b4d8',
      woodAccent: '#161b22'
    }),
    cozy_bistro: Object.freeze({
      floorLight: '#f5ebe0',
      floorDark: '#d5bdaf',
      wallColor: '#4a3e3d',
      wallTrim: '#bc6c25',
      accentColor: '#dda15e',
      secondaryAccent: '#6b705c',
      metalAccent: '#b7b7a4',
      woodAccent: '#582f0e'
    }),
    synthwave_arcade: Object.freeze({
      floorLight: '#241734',
      floorDark: '#120b1f',
      wallColor: '#1a0933',
      wallTrim: '#ff007f',
      accentColor: '#00f0ff',
      secondaryAccent: '#ffe600',
      metalAccent: '#7928ca',
      woodAccent: '#2b0938'
    }),
    zen_garden: Object.freeze({
      floorLight: '#e8e5da',
      floorDark: '#d2cebe',
      wallColor: '#3d4035',
      wallTrim: '#8c9c7e',
      accentColor: '#5c6d53',
      secondaryAccent: '#a3845b',
      metalAccent: '#c7b198',
      woodAccent: '#4a3b32'
    }),
    space_station: Object.freeze({
      floorLight: '#e0e6ed',
      floorDark: '#c5d1de',
      wallColor: '#1c2430',
      wallTrim: '#38ef7d',
      accentColor: '#11998e',
      secondaryAccent: '#00d2ff',
      metalAccent: '#90a4ae',
      woodAccent: '#263238'
    }),
    steampunk_saloon: Object.freeze({
      floorLight: '#d7c4b7',
      floorDark: '#bfa594',
      wallColor: '#3c2a21',
      wallTrim: '#c68b59',
      accentColor: '#8b4513',
      secondaryAccent: '#cd7f32',
      metalAccent: '#b87333',
      woodAccent: '#281812'
    }),
    vaporwave_mall: Object.freeze({
      floorLight: '#fde2e4',
      floorDark: '#fad2e1',
      wallColor: '#2b2d42',
      wallTrim: '#b5e2fa',
      accentColor: '#ff99c8',
      secondaryAccent: '#80ffdb',
      metalAccent: '#e2afff',
      woodAccent: '#4a4e69'
    }),
    nordic_minimal: Object.freeze({
      floorLight: '#f8f9fa',
      floorDark: '#e9ecef',
      wallColor: '#343a40',
      wallTrim: '#adb5bd',
      accentColor: '#495057',
      secondaryAccent: '#6c757d',
      metalAccent: '#ced4da',
      woodAccent: '#6c584c'
    }),
    gothic_manor: Object.freeze({
      floorLight: '#2b2b2b',
      floorDark: '#1c1c1c',
      wallColor: '#121212',
      wallTrim: '#800020',
      accentColor: '#4a0e17',
      secondaryAccent: '#2d0006',
      metalAccent: '#71797e',
      woodAccent: '#1a0f0f'
    }),
    tropical_lounge: Object.freeze({
      floorLight: '#faedcd',
      floorDark: '#e9d8a6',
      wallColor: '#005f73',
      wallTrim: '#ee9b00',
      accentColor: '#0a9396',
      secondaryAccent: '#ca6702',
      metalAccent: '#e9d8a6',
      woodAccent: '#6b705c'
    }),
    neon_tokyo: Object.freeze({
      floorLight: '#181a20',
      floorDark: '#0e1015',
      wallColor: '#08090c',
      wallTrim: '#ff0055',
      accentColor: '#00e5ff',
      secondaryAccent: '#ffe600',
      metalAccent: '#ff0055',
      woodAccent: '#1f232b'
    })
  });

  public static readonly DEFAULT_PALETTE: SocialRoomPalette = Object.freeze({
    floorLight: '#ded9d2',
    floorDark: '#d4cec5',
    wallColor: '#ded9d2',
    wallTrim: '#c59b27',
    accentColor: '#b45309',
    secondaryAccent: '#0f766e',
    metalAccent: '#c59b27',
    woodAccent: '#382417'
  });

  public static synthesize(
    themeName?: string,
    overrides?: Partial<SocialRoomPalette>
  ): SocialRoomPalette {
    if (!themeName || themeName.trim() === '' || themeName.toLowerCase() === 'none' || themeName.toLowerCase() === 'default') {
      const base = this.DEFAULT_PALETTE;
      if (!overrides) {
        return base;
      }
      return Object.freeze({
        floorLight: overrides.floorLight ?? base.floorLight,
        floorDark: overrides.floorDark ?? base.floorDark,
        wallColor: overrides.wallColor ?? base.wallColor,
        wallTrim: overrides.wallTrim ?? base.wallTrim,
        accentColor: overrides.accentColor ?? base.accentColor,
        secondaryAccent: overrides.secondaryAccent ?? base.secondaryAccent,
        metalAccent: overrides.metalAccent ?? base.metalAccent,
        woodAccent: overrides.woodAccent ?? base.woodAccent
      });
    }

    const normalizedKey = themeName.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const matchedPreset = this.PRESETS[normalizedKey];

    const base = matchedPreset ?? this.generateProceduralPalette(themeName);
    if (!overrides) {
      return base;
    }

    return Object.freeze({
      floorLight: overrides.floorLight ?? base.floorLight,
      floorDark: overrides.floorDark ?? base.floorDark,
      wallColor: overrides.wallColor ?? base.wallColor,
      wallTrim: overrides.wallTrim ?? base.wallTrim,
      accentColor: overrides.accentColor ?? base.accentColor,
      secondaryAccent: overrides.secondaryAccent ?? base.secondaryAccent,
      metalAccent: overrides.metalAccent ?? base.metalAccent,
      woodAccent: overrides.woodAccent ?? base.woodAccent
    });
  }

  public static getKnownThemes(): ReadonlyArray<string> {
    return Object.keys(this.PRESETS);
  }

  private static generateProceduralPalette(seed: string): SocialRoomPalette {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);

    const baseHue = positiveHash % 360;
    const compHue = (baseHue + 180) % 360;
    const triadicHue = (baseHue + 120) % 360;
    const analogHue = (baseHue + 30) % 360;

    const isDarkVibe =
      seed.includes('dark') ||
      seed.includes('night') ||
      seed.includes('cyber') ||
      seed.includes('neon') ||
      seed.includes('space') ||
      seed.includes('goth');

    const floorLight = isDarkVibe
      ? this.hslToHex(baseHue, 0.2, 0.16)
      : this.hslToHex(baseHue, 0.15, 0.92);

    const floorDark = isDarkVibe
      ? this.hslToHex(baseHue, 0.25, 0.1)
      : this.hslToHex(baseHue, 0.2, 0.84);

    const wallColor = this.hslToHex(baseHue, 0.35, isDarkVibe ? 0.08 : 0.2);
    const wallTrim = this.hslToHex(compHue, 0.75, 0.55);
    const accentColor = this.hslToHex(analogHue, 0.7, 0.45);
    const secondaryAccent = this.hslToHex(triadicHue, 0.65, 0.35);
    const metalAccent = this.hslToHex((baseHue + 45) % 360, 0.6, 0.6);
    const woodAccent = this.hslToHex(25, 0.45, 0.18);

    return Object.freeze({
      floorLight,
      floorDark,
      wallColor,
      wallTrim,
      accentColor,
      secondaryAccent,
      metalAccent,
      woodAccent
    });
  }

  private static hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    const rHex = Math.round((r + m) * 255)
      .toString(16)
      .padStart(2, '0');
    const gHex = Math.round((g + m) * 255)
      .toString(16)
      .padStart(2, '0');
    const bHex = Math.round((b + m) * 255)
      .toString(16)
      .padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }
}
