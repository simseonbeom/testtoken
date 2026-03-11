import StyleDictionary from "style-dictionary";
import { register } from "@tokens-studio/sd-transforms";
import fs from "node:fs";

await register(StyleDictionary);

const raw = JSON.parse(fs.readFileSync("./data/tokens.json", "utf-8"));

/**
 * {black} -> {global.black}
 * {md} -> {global.md}
 * {white} -> {global.white}
 * 같은 shorthand reference를 global 기준으로 보정
 */
function normalizeReference(value) {
  if (typeof value !== "string") return value;

  return value.replace(/\{([^}]+)\}/g, (_, refName) => {
    if (refName.includes(".")) return `{${refName}}`;
    return `{global.${refName}}`;
  });
}

/**
 * spacing 타입에서
 * "4" -> "4px"
 * "{md}" -> "{global.md}"
 * "{md} *2" -> "8px" 로 계산
 */
function normalizeTokenValue(token, globalTokens) {
  let value = token.value;

  if (typeof value !== "string") return value;

  value = normalizeReference(value);

  if (token.type === "spacing") {
    // 순수 숫자면 px 붙이기
    if (/^\d+(\.\d+)?$/.test(value.trim())) {
      return `${value.trim()}px`;
    }

    // {global.md} *2 형태 계산
    const match = value.match(/^\{global\.([^\}]+)\}\s*\*\s*(\d+(\.\d+)?)$/);
    if (match) {
      const refKey = match[1];
      const multiplier = Number(match[2]);
      const refToken = globalTokens[refKey];

      if (refToken) {
        const refRaw = String(refToken.value).trim();
        const refNumber = Number(refRaw);

        if (!Number.isNaN(refNumber)) {
          return `${refNumber * multiplier}px`;
        }
      }
    }
  }

  return value;
}

/**
 * 현재 tokens.json 구조에서
 * global + theme(light or dark)를 합쳐
 * Style Dictionary용 토큰 객체로 변환
 */
function buildThemeTokens(themeName) {
  const globalTokens = raw.global ?? {};
  const themeTokens = raw[themeName] ?? {};

  const result = {};

  // global 먼저
  for (const [key, token] of Object.entries(globalTokens)) {
    if (!token || typeof token !== "object" || !("value" in token)) continue;

    result[key] = {
      value: normalizeTokenValue(token, globalTokens),
      type: token.type,
    };
  }

  // theme 토큰 덮어쓰기/추가
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

export default {
  hooks: {
    parsers: {
      "tokens-studio-theme-parser": {
        pattern: /tokens\.json$/,
        parser: ({ filePath }) => {
          // source에서 직접 안 쓰고 inline tokens를 쓸 거라 여기선 안 써도 됨
          return {};
        },
      },
    },
  },

  platforms: {
    light: {
      transformGroup: "tokens-studio",
      buildPath: "build/",
      prefix: "ds",
      // source 대신 inline tokens 사용
      tokens: lightTokens,
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

    dark: {
      transformGroup: "tokens-studio",
      buildPath: "build/",
      prefix: "ds",
      tokens: darkTokens,
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
};
