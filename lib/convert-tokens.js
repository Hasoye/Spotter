/**
 * Design Tokens to CSS Variables Converter
 * 
 * Converts design tokens JSON (e.g. W3C / Figma format) into CSS custom properties.
 * Follows standard color system practices:
 * - Differentiates primitive colors (palette/scales) from semantic color roles (UI usage).
 * - Converts token alias references (e.g. "{color.primitive.brand.500}") into CSS `var(--color-primitive-brand-500)`.
 * - Formats typography tokens into modular custom properties.
 * - Formats custom shadow effects into standard CSS box-shadow definitions.
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert string to kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert token alias references (e.g. "{color.primitive.primary.500}" or "$color.primitive.primary.500")
 * to CSS var(...) function (e.g. "var(--color-primitive-primary-500)")
 */
function convertReferenceToVar(value) {
  if (typeof value !== 'string') return value;

  const refRegex = /^\{([^}]+)\}$|^\$([a-zA-Z0-9._-]+)$/;
  const match = value.match(refRegex);
  if (match) {
    const refPath = match[1] || match[2];
    const varName = `--${toKebabCase(refPath.replace(/\./g, '-'))}`;
    return `var(${varName})`;
  }

  return value.replace(/\{([^}]+)\}/g, (_, refPath) => {
    const varName = `--${toKebabCase(refPath.replace(/\./g, '-'))}`;
    return `var(${varName})`;
  });
}

/**
 * Format numeric dimensions into CSS length units
 */
function formatDimension(val) {
  if (typeof val === 'number') {
    return val === 0 ? '0' : `${val}px`;
  }
  return val;
}

/**
 * Format effect/shadow token into a valid CSS box-shadow string
 */
function formatShadow(effectValue) {
  if (typeof effectValue === 'string') return effectValue;
  if (!effectValue || typeof effectValue !== 'object') return '';

  const { offsetX = 0, offsetY = 0, radius = 0, spread = 0, color = 'transparent' } = effectValue;
  const x = formatDimension(offsetX);
  const y = formatDimension(offsetY);
  const r = formatDimension(radius);
  const s = formatDimension(spread);
  const c = convertReferenceToVar(color);

  return `${x} ${y} ${r} ${s} ${c}`;
}

/**
 * Recursively parse token JSON structure into categorized CSS custom properties
 */
function parseTokens(obj, currentPath = [], result = { primitives: [], roles: [], effects: [], typography: [], others: [] }) {
  if (!obj || typeof obj !== 'object') return result;

  // Leaf node token with a 'value' property
  if (Object.prototype.hasOwnProperty.call(obj, 'value') && !Object.prototype.hasOwnProperty.call(obj, 'fontSize')) {
    const varName = `--${currentPath.map(toKebabCase).join('-')}`;
    let rawValue = obj.value;
    let formattedValue;

    if (obj.type === 'custom-shadow' || (currentPath.includes('effect') || currentPath.includes('shadow'))) {
      formattedValue = formatShadow(rawValue);
    } else if (obj.type === 'dimension' || typeof rawValue === 'number') {
      formattedValue = typeof rawValue === 'number' && !currentPath.includes('font-weight') ? formatDimension(rawValue) : String(rawValue);
    } else {
      formattedValue = convertReferenceToVar(String(rawValue));
    }

    const cssRule = `  ${varName}: ${formattedValue};`;
    const pathStr = currentPath.join('.').toLowerCase();

    if (pathStr.includes('primitive') || pathStr.includes('palette') || pathStr.includes('base')) {
      result.primitives.push({ varName, value: formattedValue, rawValue, cssRule });
    } else if (pathStr.includes('role') || pathStr.includes('sys') || pathStr.includes('semantic') || (pathStr.includes('color') && !pathStr.includes('primitive'))) {
      result.roles.push({ varName, value: formattedValue, rawValue, cssRule });
    } else if (pathStr.includes('effect') || pathStr.includes('shadow')) {
      result.effects.push({ varName, value: formattedValue, rawValue, cssRule });
    } else {
      result.others.push({ varName, value: formattedValue, rawValue, cssRule });
    }

    return result;
  }

  // Iterate object properties
  for (const [key, val] of Object.entries(obj)) {
    if (!val || typeof val !== 'object') continue;

    // Special handling for typography token groups
    if (currentPath[0] === 'typography' || key === 'typography') {
      const isTypographyStyleObj = Object.values(val).some(
        prop => prop && typeof prop === 'object' && Object.prototype.hasOwnProperty.call(prop, 'value')
      );

      if (isTypographyStyleObj) {
        const styleName = key;
        const groupPath = [...currentPath, styleName];

        for (const [propName, propObj] of Object.entries(val)) {
          if (propObj && typeof propObj === 'object' && Object.prototype.hasOwnProperty.call(propObj, 'value')) {
            const varName = `--${groupPath.map(toKebabCase).join('-')}-${toKebabCase(propName)}`;
            let propVal = propObj.value;

            if (propName === 'fontSize' || propName === 'lineHeight' || propName === 'letterSpacing') {
              propVal = formatDimension(propVal);
            }

            const cssRule = `  ${varName}: ${convertReferenceToVar(String(propVal))};`;
            result.typography.push({ varName, value: propVal, cssRule });
          }
        }
        continue;
      }
    }

    parseTokens(val, [...currentPath, key], result);
  }

  return result;
}

/**
 * Generate complete CSS file content from token object
 */
function convertTokensToCSS(tokensJson) {
  const parsed = parseTokens(tokensJson);
  const lines = [];

  lines.push('/* Auto-generated from design-tokens.tokens.json. Do not edit directly. */');
  lines.push(':root {');

  if (parsed.primitives.length > 0) {
    lines.push('  /* ==========================================================================');
    lines.push('     PRIMITIVE COLOR TOKENS');
    lines.push('     Base color scales & palettes. DO NOT use directly in UI components.');
    lines.push('     ========================================================================== */');
    parsed.primitives.forEach(item => lines.push(item.cssRule));
    lines.push('');
  }

  if (parsed.roles.length > 0) {
    lines.push('  /* ==========================================================================');
    lines.push('     COLOR ROLES (SEMANTIC TOKENS)');
    lines.push('     Use these semantic variables directly in UI styling.');
    lines.push('     ========================================================================== */');
    parsed.roles.forEach(item => lines.push(item.cssRule));
    lines.push('');
  }

  if (parsed.effects.length > 0) {
    lines.push('  /* ==========================================================================');
    lines.push('     EFFECTS & SHADOWS');
    lines.push('     ========================================================================== */');
    parsed.effects.forEach(item => lines.push(item.cssRule));
    lines.push('');
  }

  if (parsed.typography.length > 0) {
    lines.push('  /* ==========================================================================');
    lines.push('     TYPOGRAPHY SYSTEM');
    lines.push('     ========================================================================== */');
    parsed.typography.forEach(item => lines.push(item.cssRule));
    lines.push('');
  }

  if (parsed.others.length > 0) {
    lines.push('  /* ==========================================================================');
    lines.push('     GENERAL DESIGN TOKENS');
    lines.push('     ========================================================================== */');
    parsed.others.forEach(item => lines.push(item.cssRule));
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * CLI execution entrypoint
 */
function main() {
  const defaultInputPath = path.resolve(__dirname, '../design-tokens.tokens.json');
  const defaultOutputPath = path.resolve(__dirname, '../app/design-tokens.css');

  const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInputPath;
  const outputPath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : defaultOutputPath;

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Design tokens file not found at ${inputPath}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const tokens = JSON.parse(rawData);
    const cssContent = convertTokensToCSS(tokens);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, cssContent, 'utf-8');
    console.log(`Successfully converted design tokens from:\n  Input:  ${inputPath}\n  Output: ${outputPath}`);
  } catch (err) {
    console.error('Failed to convert design tokens:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  toKebabCase,
  convertReferenceToVar,
  formatShadow,
  parseTokens,
  convertTokensToCSS,
};
