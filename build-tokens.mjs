import StyleDictionary from "style-dictionary";
import { register } from "@tokens-studio/sd-transforms";
import fs from "node:fs";

await register(StyleDictionary);

const raw = JSON.parse(fs.readFileSync("./data/tokens.json", "utf-8"));

function normalizeTokenValue(token, globalTokens) {
  let value = token.value;

  if (typeof value !== "string") return value;

  if (token.type === "spacing") {
    const trimmed = value.trim();

    // "4" -> "4px"
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return `${trimmed}px`;
    }

    // "{md}" -> 그대로 둠 (같은 레벨의 md를 참조)
    if (/^\{[^}]+\}$/.test(trimmed)) {
      return trimmed;
    }

    // "{md} *2" -> 8px 계산
    const match = trimmed.match(/^\{([^}]+)\}\s*\*\s*(\d+(\.\d+)?)$/);
    if (match) {
      const refKey = match[1];
      const multiplier = Number(match[2]);
      const refToken = globalTokens[refKey];

      if (refToken) {
        const refNumber = Number(String(refToken.value).trim());
        if (!Number.isNaN(refNumber)) {
          return `${refNumber * multiplier}px`;
        }
      }
    }
  }

  // color의 {black}, {white} 같은 참조는 그대로 유지
  return value;
}

function buildThemeTokens(themeName) {
  const globalTokens = raw.global ?? {};
  const themeTokens = raw[themeName] ?? {};

  const result = {};

  for (const [key, token] of Object.entries(globalTokens)) {
    if (!token || typeof token !== "object" || !("value" in token)) continue;

    result[key] = {
      value: normalizeTokenValue(token, globalTokens),
      type: token.type,
    };
  }

  for (const [key, token] of Object.entries(themeTokens)) {
    if (!token || typeof token !== "object" || !("value" in token)) continue;

    result[key] = {
      value: normalizeTokenValue(token, globalTokens),
      type: token.type,
    };
  }

  return result;
}

const lightTokens = buildThemeTokens("light");
const darkTokens = buildThemeTokens("dark");

const lightSD = new StyleDictionary(
  {
    tokens: lightTokens,
    platforms: {
      css: {
        transformGroup: "tokens-studio",
        buildPath: "build/",
        prefix: "ds",
        files: [
          {
            destination: "light.css",
            format: "css/variables",
            options: {
              outputReferences: false,
              selector: ":root",
            },
          },
        ],
      },
    },
  },
  { verbosity: "verbose" },
);

const darkSD = new StyleDictionary(
  {
    tokens: darkTokens,
    platforms: {
      css: {
        transformGroup: "tokens-studio",
        buildPath: "build/",
        prefix: "ds",
        files: [
          {
            destination: "dark.css",
            format: "css/variables",
            options: {
              outputReferences: false,
              selector: '[data-theme="dark"]',
            },
          },
        ],
      },
    },
  },
  { verbosity: "verbose" },
);

await lightSD.buildAllPlatforms();
await darkSD.buildAllPlatforms();

console.log("✅ build/light.css, build/dark.css 생성 완료");
