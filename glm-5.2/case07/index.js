#!/usr/bin/env node
'use strict';

/**
 * wordcloud-cli
 *
 * Reads a text file, computes word frequencies, and renders a word-cloud
 * visualization to a PNG image (wordcloud.png by default, overridable with -o).
 *
 * Usage:
 *   node index.js <input.txt> [-o output.png] [-w width] [-h height]
 *                              [--max count] [--bg color] [--min-size px]
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const cloud = require('d3-cloud');
const minimist = require('minimist');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_OUTPUT = 'wordcloud.png';
const DEFAULT_MAX_WORDS = 200;
const DEFAULT_MIN_SIZE = 12;
const DEFAULT_MAX_SIZE = 96;
const DEFAULT_BG = '#ffffff';

// Common English stopwords (lowercase).
const EN_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','of','at','by','for','with',
  'about','against','between','into','through','during','before','after','above',
  'below','to','from','up','down','in','out','on','off','over','under','again',
  'further','once','here','there','when','where','why','how','all','any','both',
  'each','few','more','most','other','some','such','no','nor','not','only','own',
  'same','so','than','too','very','can','will','just','should','now','is','am',
  'are','was','were','be','been','being','have','has','had','do','does','did',
  'doing','would','could','should','may','might','must','shall','this','that',
  'these','those','i','me','my','we','our','you','your','he','him','his','she',
  'her','it','its','they','them','their','what','which','who','whom','as','also',
  'it','its','s','t','d','ll','re','ve','m'
]);

// Common Chinese single-char / 2-gram stopwords.
const CN_STOPWORDS = new Set([
  '的','了','是','在','和','也','就','都','与','或','而','但','还','不','没','无',
  '我','你','他','她','它','们','这','那','些','个','一','上','下','中','为','把',
  '被','让','给','到','从','向','对','以','于','之','其','所','得','着','过','地',
  '里','内','外','后','前','已','将','要','会','能','可','应','该','只','才','再',
  '又','更','最','很','太','则','即','由','并','且','如','若','因','故','使','令',
  '一个','可以','这是','就是','我们','你们','他们','所以','因为','如果','虽然','但是'
]);

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = minimist(argv, {
    alias: { o: 'output', w: 'width', h: 'height' },
    default: {
      output: DEFAULT_OUTPUT,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      max: DEFAULT_MAX_WORDS,
      'min-size': DEFAULT_MIN_SIZE,
      'max-size': DEFAULT_MAX_SIZE,
      bg: DEFAULT_BG
    },
    string: ['output', 'bg'],
    '--': false
  });

  const input = args._[0];
  return {
    input,
    output: args.output,
    width: parseInt(args.width, 10),
    height: parseInt(args.height, 10),
    maxWords: parseInt(args.max, 10),
    minSize: parseInt(args['min-size'], 10),
    maxSize: parseInt(args['max-size'], 10),
    bg: args.bg
  };
}

function printUsage() {
  const usage = `wordcloud-cli — generate a word cloud PNG from a text file

Usage:
  wordcloud <input.txt> [options]

Options:
  -o, --output <file>      Output PNG file name (default: wordcloud.png)
  -w, --width <px>         Canvas width in pixels (default: 1280)
  -h, --height <px>        Canvas height in pixels (default: 720)
      --max <n>            Maximum number of words drawn (default: 200)
      --min-size <px>      Minimum font size (default: 12)
      --max-size <px>      Maximum font size (default: 96)
      --bg <color>         Background color, e.g. #ffffff or black (default: #ffffff)
      --help               Show this help

Example:
  wordcloud article.txt -o cloud.png -w 1600 -h 900
`;
  process.stdout.write(usage);
}

// ---------------------------------------------------------------------------
// Tokenization & frequency
// ---------------------------------------------------------------------------

/**
 * Tokenize text into words.
 *  - Latin words: maximal runs of letters (with internal '-' and '\'').
 *  - CJK: sliding 2-character grams over runs of Han characters (a light-weight
 *    approximation of segmentation that works without a dictionary; single CJK
 *    characters that survive the stopword filter are also emitted).
 */
function tokenize(text) {
  const tokens = [];

  // Latin / digit words.
  const latinRe = /[A-Za-z][A-Za-z'-]*/g;
  let m;
  while ((m = latinRe.exec(text)) !== null) {
    const w = m[0].toLowerCase().replace(/^['-]+|['-]+$/g, '');
    if (w.length < 2) continue;
    if (EN_STOPWORDS.has(w)) continue;
    tokens.push(w);
  }

  // CJK runs.
  const cjkRe = /[一-鿿㐀-䶿]+/g;
  while ((m = cjkRe.exec(text)) !== null) {
    const run = m[0];
    for (let i = 0; i < run.length - 1; i++) {
      const g = run.slice(i, i + 2);
      if (!CN_STOPWORDS.has(g)) tokens.push(g);
    }
  }

  return tokens;
}

function countFrequencies(tokens) {
  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

// ---------------------------------------------------------------------------
// Font selection (works across macOS / Linux, with CJK fallback)
// ---------------------------------------------------------------------------

function pickFont() {
  const candidates = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        GlobalFonts.registerFromPath(p, 'WordCloudCJK');
        if (GlobalFonts.has('WordCloudCJK')) return 'WordCloudCJK';
      } catch (_) {
        // fall through to next candidate
      }
    }
  }
  return 'sans-serif';
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

function makeColorizer() {
  // Deterministic golden-angle hue walk; saturation/lightness held constant
  // for a pleasant, cohesive palette.
  let h = Math.floor(40 + (Date.now() % 360));
  return function () {
    h = (h + 47.5) % 360;
    return `hsl(${h.toFixed(0)}, 65%, 45%)`;
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args._help || process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  if (!args.input) {
    process.stderr.write('Error: no input file given.\n\n');
    printUsage();
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`Error: input file not found: ${inputPath}\n`);
    process.exit(1);
  }

  const width = Number.isFinite(args.width) && args.width > 0 ? args.width : DEFAULT_WIDTH;
  const height = Number.isFinite(args.height) && args.height > 0 ? args.height : DEFAULT_HEIGHT;
  const minSize = args.minSize > 0 ? args.minSize : DEFAULT_MIN_SIZE;
  const maxSize = args.maxSize > 0 ? args.maxSize : DEFAULT_MAX_SIZE;

  let raw;
  try {
    raw = fs.readFileSync(inputPath, 'utf8');
  } catch (e) {
    process.stderr.write(`Error reading file: ${e.message}\n`);
    process.exit(1);
  }

  const tokens = tokenize(raw);
  if (tokens.length === 0) {
    process.stderr.write('Error: no words found in input file.\n');
    process.exit(1);
  }

  const freq = countFrequencies(tokens);
  const maxCount = Math.max(...freq.values());

  const entries = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, args.maxWords);

  // Map frequency -> font size via sqrt scale (sqrt keeps small words legible
  // while still emphasizing frequent ones).
  const sizeFor = (count) =>
    Math.round(minSize + (maxSize - minSize) * Math.sqrt(count / maxCount));

  const words = entries.map(([text, count]) => ({
    text,
    count,
    size: sizeFor(count)
  }));

  const fontFamily = pickFont();
  const canvas = createCanvas(width, height);
  const color = makeColorizer();

  process.stderr.write(
    `Generating word cloud: ${words.length} words, ${width}x${height}, font="${fontFamily}"\n`
  );

  const layout = cloud()
    .size([width, height])
    .canvas(() => createCanvas(1, 1))
    .words(words)
    .padding(3)
    .rotate(() => (Math.random() < 0.75 ? 0 : 90))
    .font(fontFamily)
    .fontSize((d) => d.size)
    .on('end', draw);

  function draw(placed) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = args.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const w of placed) {
      ctx.save();
      ctx.translate(w.x + width / 2, w.y + height / 2);
      ctx.rotate((w.rotate * Math.PI) / 180);
      ctx.font = `${w.size}px ${fontFamily}`;
      ctx.fillStyle = color();
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }

    const outPath = path.resolve(args.output);
    try {
      fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
      process.stderr.write(`Wrote ${outPath}\n`);
      process.exit(0);
    } catch (e) {
      process.stderr.write(`Error writing PNG: ${e.message}\n`);
      process.exit(1);
    }
  }

  layout.start();
}

main();
