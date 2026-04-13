# Deployment & Asset Loading Guide

This is a **Next.js static export** app that works offline and can be opened directly or served via HTTP.

## Issues Fixed

✅ **Asset Path Configuration**: Added `assetPrefix: './'` to `next.config.ts` for proper relative path resolution  
✅ **Error Handling**: Enhanced error handling for file:// protocol scenarios  
✅ **Diagnostics**: Added protocol detection and console logging to help diagnose asset loading issues  
✅ **Audio Loading**: Improved audio fallbacks for file:// protocol restrictions  
✅ **Data Fallbacks**: JSON data loading has graceful fallbacks when fetch fails  

## Two Ways to Run the App

### Option 1: HTTP Server (Recommended ✨)

**Best option** - Avoids all browser security restrictions with file:// protocol.

#### Using Python (simplest):
```bash
cd out/
python -m http.server 8000
# OR if Python 2:
python -m SimpleHTTPServer 8000
```
Then open: **http://localhost:8000**

#### Using Node.js:
```bash
cd out/
npx http-server -p 8000
```
Then open: **http://localhost:8000**

#### Using Node.js with live reload:
```bash
cd out/
npx live-server --port=8000
```

### Option 2: Direct HTML File (Quick Test)

You can open the file directly in a browser:
```bash
# From the flappybird folder
open out/index.html
# Or on Linux:
xdg-open out/index.html
```

**Note**: Some features may not work properly with `file://` protocol:
- Audio might not load
- Fetch requests for JSON may be blocked
- Browser console may show CORS warnings

**Console Diagnostic Messages**:
- 📁 "Running from file://" - Indicates file protocol restrictions
- ⚠️ "Failed to load" - Asset loading failure (check console for details)
- 💡 Helpful tips for better setup

## Build & Deployment

### Local Build & Test
```bash
# Install dependencies (if needed)
npm install

# Build the static export
npm run build

# Serve the output
cd out/
python -m http.server 8000
```

### Deploy to Web Server

The `out/` folder is a complete static site. Copy it to any web server:

- **GitHub Pages**: Copy `out/` contents to docs folder, enable GitHub Pages
- **Netlify**: Drop `out/` folder for instant deployment
- **Vercel**: Deploy the entire project directory
- **Any HTTP Server**: Copy `out/` contents to your web root

### Environment Variables

The app works completely offline - no environment variables needed!

Data persists in:
- **localStorage**: Player scores (automatic, browser-side)
- **JSON files**: Embedded game settings and initial scores

## Asset Structure

All assets are in the `out/` directory after build:

```
out/
├── index.html              # Main entry point
├── _next/                  # Next.js runtime & chunks
├── flappy-bird-assets-master/
│   ├── sprites/           # Game sprites (PNG)
│   └── audio/             # Sound effects (WAV)
├── free-city-backgrounds-pixel-art/
│   └── city 1-8/          # Background layers
├── data/
│   ├── scores.json        # Leaderboard data
│   └── game-settings.json # Game configuration
└── music/                 # Background music tracks
```

## Troubleshooting

### Assets not loading when opening HTML directly?

1. **Use HTTP server** (see Option 1 above) - This is the recommended fix
2. **Check browser console** (F12) for error messages
3. **Look for diagnostic info** starting with 📁 or ⚠️

### Audio not playing?

- File:// protocol restricts audio loading - use HTTP server
- Check volume isn't muted in-game
- Some browsers need user interaction before audio plays

### Blank screen or slow to load?

- Open DevTools (F12) → Console tab
- Look for "Failed to load image" messages
- If using file://, switch to HTTP server

### Scores not saving?

- Make sure localStorage is enabled (Settings → Privacy)
- In incognito/private browsing, localStorage is cleared on close
- Scores are stored locally in your browser, not synced

## Browser Support

- Chrome/Edge: ✅ Full support with HTTP server, partial with file://
- Firefox: ✅ Full support with HTTP server, partial with file://
- Safari: ✅ Full support with HTTP server, limited file:// support
- Mobile browsers: ✅ Works great with HTTP server

## Production Notes

- The app is self-contained in the `out/` folder
- No backend server needed
- No database required  
- All data is stored client-side
- Scores persist per browser/device
- Build is ~5MB static files (including all assets)

## Next Steps

1. If deploying: Use HTTP server above or upload `out/` to web host
2. For development: Run `npm run dev` (not for deployment)
3. For Chromebook: Serve from `out/` directory on local HTTP server
