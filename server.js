// File: server.js

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv').config();
const axios = require('axios');

const sharp = require('sharp');
const { default: pixelmatch } = require('pixelmatch');
const { PNG } = require('pngjs');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');


const express = require('express');
const app = express();

// ✅ Allow ONLY your frontend URL
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://figma-ui-diff-tool-1.onrender.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200); // Handle preflight
  }
  next();
});

app.use(express.json());              // ✅ Must be before routes
app.use(express.static('uploads')); 

const upload = multer({ dest: 'uploads/' });

const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

function padImage(png, targetHeight) {
  const padded = new PNG({ width: png.width, height: targetHeight });
  PNG.bitblt(png, padded, 0, 0, png.width, png.height, 0, 0);
  return padded;
}

app.post(
  '/upload',
  upload.fields([
    { name: 'figma', maxCount: 1 },
    { name: 'actual', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const figma = req.files.figma[0];
      const actual = req.files.actual[0];

      console.log('✅ Received files:', figma.path, actual.path);

      // Resize both images to same width (800px)
      const figmaResized = await sharp(figma.path).resize({ width: 800 }).png().toBuffer();
      const actualResized = await sharp(actual.path).resize({ width: 800 }).png().toBuffer();

      const figmaPNG = PNG.sync.read(figmaResized);
      const actualPNG = PNG.sync.read(actualResized);

      // Pad images to match height
      const targetHeight = Math.max(figmaPNG.height, actualPNG.height);
      const paddedFigma = padImage(figmaPNG, targetHeight);
      const paddedActual = padImage(actualPNG, targetHeight);

      const { width } = paddedFigma;
      const diff = new PNG({ width, height: targetHeight });

      // Generate pixel diff
      pixelmatch(
        paddedFigma.data,
        paddedActual.data,
        diff.data,
        width,
        targetHeight,
        { threshold: 0.1 }
      );

      const diffBuffer = PNG.sync.write(diff);
      const diffBase64 = `data:image/png;base64,${diffBuffer.toString('base64')}`;

      // Convert images to base64 for Gemini
      const figmaBase64 = figmaResized.toString('base64');
      const actualBase64 = actualResized.toString('base64');

      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                text:
                  'You are a precise UI QA assistant. Compare the two UI screenshots provided — one is the Figma design and the other is the actual implementation. Give a detailed visual comparison covering layout, alignment, spacing, font style and size, color (including even subtle differences), and any missing or extra elements. Be strict in identifying pixel-level differences, especially around buttons, headers, and icons. Highlight differences clearly and do not ignore small color or font mismatches. Please format the response as Figma vs Implemented and include a summary table at the end.'
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: figmaBase64,
                },
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: actualBase64,
                },
              },
            ],
          },
        ],
      };

      const geminiRes = await axios.post(GEMINI_API, geminiPayload, {
        headers: { 'Content-Type': 'application/json' },
      });

      const report =
        geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'No report generated.';

      console.log('✅ Gemini API success!');

      res.json({ report, diffImage: diffBase64 });
    } catch (err) {
      console.error('❌ Error:', err);
      res.status(500).json({ error: 'Image comparison failed.' });
    }
  }
);

async function disableHoverAndCleanup(page, site) {
  await page.evaluate((siteUrl) => {
    // 💡 Block all hover popups globally
    const style = document.createElement('style');
    style.innerHTML = '*:hover { pointer-events: none !important; }';
    document.head.appendChild(style);

    // 🧹 Flipkart: remove Login popup if visible
    if (siteUrl.includes('flipkart.com')) {
      const loginPopup = document.querySelector('._1C1Fl6');
      if (loginPopup) loginPopup.remove();
    }
  }, site);
}



app.post('/extract-live-element', async (req, res) => {
  const { selector, url } = req.body;

  if (!selector || !url) {
    return res.status(400).json({ error: 'Missing selector or URL' });
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Escape Tailwind-style selectors (e.g., md:mb-4 → md\:mb-4)
    const escapeSelector = (selector) => selector.replace(/:/g, '\\:');
    const escapedSelector = escapeSelector(selector);

    await page.waitForSelector(escapedSelector, { timeout: 30000 });

    const element = await page.$(escapedSelector);

    if (!element) {
      throw new Error('Element not found.');
    }

    await page.addStyleTag({ content: '*:hover { pointer-events: none !important; }' });
    // Capture screenshot
    const screenshotPath = `uploads/extracted-${Date.now()}.png`;
    await element.screenshot({ path: screenshotPath });

    // Extract computed styles and metadata
  const computedStyles = await page.evaluate((el) => {
  const computed = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  // ✅ Extract all non-hidden <input> fields
  const inputFields = Array.from(el.querySelectorAll('input'))
    .filter(input => input.type !== 'hidden') // Exclude hidden inputs
    .map(input => ({
      type: input.type,
      name: input.name || null,
      placeholder: input.placeholder || null,
      value: input.value || ''
    }));

  // ✅ Extract dropdown <select> options (if any within the element)
  const dropdownOptions = Array.from(el.querySelectorAll('select')).flatMap(select =>
    Array.from(select.options).map(opt => opt.textContent.trim())
  );
   // ✅ Normalize font weight
  let fontWeight = computed.fontWeight;
  if (fontWeight === 'normal') fontWeight = '400';
  if (fontWeight === 'bold') fontWeight = '700';

  // ✅ Map numeric weight to readable name
  let fontWeightName = null;
  if (fontWeight === '100') fontWeightName = 'thin';
  else if (fontWeight === '200') fontWeightName = 'extra-light';
  else if (fontWeight === '300') fontWeightName = 'light';
  else if (fontWeight === '400') fontWeightName = 'normal';
  else if (fontWeight === '500') fontWeightName = 'medium';
  else if (fontWeight === '600') fontWeightName = 'semi-bold';
  else if (fontWeight === '700') fontWeightName = 'bold';
  else if (fontWeight === '800') fontWeightName = 'extra-bold';
  else if (fontWeight === '900') fontWeightName = 'black';

  return {
    tag: el.tagName,
    textContent: el.textContent.trim(),
    placeholder: el.getAttribute('placeholder') || null,
    inputFields,
    dropdownOptions,
    fontFamily: computed.fontFamily,
    fontSize: computed.fontSize,
    fontWeight: fontWeight,
    fontWeightName: fontWeightName, // ✅ Added
    color: computed.color,
    backgroundColor: computed.backgroundColor,
    padding: computed.padding,
    margin: computed.margin,
    textAlign: computed.textAlign,
    display: computed.display,
    position: computed.position,
    width: rect.width,
    height: rect.height,
    style: el.getAttribute('style') || null // ✅ Added
  };
}, element);

await browser.close();


    // Save extracted styles to a JSON file
    const folderPath = path.join(__dirname, 'extracted');
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

   const fileSafeName = selector.replace(/[^\w-]/g, '_');
    const jsonPath = path.join(folderPath, `${fileSafeName}-styles.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(computedStyles, null, 2));

    // Convert screenshot to base64
    const base64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
    const dataUri = `data:image/png;base64,${base64}`;

    res.json({ screenshotBase64: dataUri, computedStyles });
  } catch (err) {
    console.error('❌ Puppeteer error:', err);
    res.status(500).json({ error: err.message || 'Extraction failed' });
  }
});



const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

//app.listen(3001, () => {
 // console.log('🚀 Server running at http://localhost:3001');
//});
