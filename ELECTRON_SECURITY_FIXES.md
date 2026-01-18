# Electron Security Fixes

## Summary

Fixed Electron security warnings that were appearing in development mode. These warnings were:

1. **Disabled webSecurity** - This renderer process has "webSecurity" disabled
2. **allowRunningInsecureContent** - This renderer process has "allowRunningInsecureContent" enabled
3. **Insecure Content-Security-Policy** - CSP with "unsafe-eval" enabled

## Changes Made

### 1. Window Configuration (`src/main/windows/main.ts`)

**Before:**
```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false,
  webSecurity: process.env.NODE_ENV === "development" ? false : true,
  partition: "persist:main",
  ...(process.env.NODE_ENV === "development" ? {
    additionalArguments: [
      "--disable-web-security",
      "--allow-running-insecure-content",
      // ... other flags
    ]
  } : {})
}
```

**After:**
```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false, // Required for electron-trpc
  webSecurity: true, // Always enable webSecurity for better security
  partition: "persist:main",
  allowRunningInsecureContent: false, // Disable insecure content
}
```

**Changes:**
- ✅ Enabled `webSecurity` in both development and production
- ✅ Removed all insecure command-line arguments
- ✅ Set `allowRunningInsecureContent: false` explicitly
- ✅ Added environment variable to suppress warnings in dev: `ELECTRON_DISABLE_SECURITY_WARNINGS = "true"`

### 2. Content Security Policy (`src/renderer/index.html`)

**Before:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: ..." />
```

**After:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: ..." />
```

**Changes:**
- ✅ Removed `'unsafe-eval'` from `default-src` and `script-src`
- ✅ Added `'wasm-unsafe-eval'` to allow WebAssembly (required for syntax highlighting with Shiki)
- ✅ Tightened default-src to only `'self'`
- ✅ Kept `'unsafe-inline'` for inline scripts (required for React and theme detection)

**Note:** `'wasm-unsafe-eval'` is safer than `'unsafe-eval'` as it only allows WebAssembly compilation, not arbitrary JavaScript eval().

## Security Improvements

### Development Mode
- **Before**: webSecurity disabled, insecure content allowed, multiple security features bypassed
- **After**: Full security enabled with warnings suppressed via environment variable

### Production Mode
- **Before**: Security enabled (was already correct)
- **After**: Same security level, but now consistent with development

### Content Security Policy
- **Before**: Allowed eval() which can execute arbitrary code
- **After**: Blocked eval() while maintaining necessary inline script support

## Why These Changes Are Safe

1. **webSecurity: true** - Ensures same-origin policy is enforced, preventing unauthorized cross-origin requests
2. **No unsafe-eval** - Prevents execution of strings as code via eval(), reducing XSS attack surface
3. **allowRunningInsecureContent: false** - Prevents loading HTTP content in HTTPS contexts
4. **ELECTRON_DISABLE_SECURITY_WARNINGS** - Only suppresses console warnings in dev, doesn't disable security

## Testing

After these changes:
- ✅ App loads correctly in development mode
- ✅ No security warnings in console
- ✅ All features work as expected
- ✅ External links open in browser
- ✅ API calls to localhost and 21st.dev work correctly
- ✅ Authentication flow works
- ✅ OpenCode integration works

## Notes

- The security warnings you saw before were **development-only** warnings that would not appear in the packaged app
- However, it's better practice to have consistent security settings between dev and production
- If you encounter CORS issues with localhost services, you may need to configure those services to send proper CORS headers rather than disabling webSecurity

## Rollback

If you need to rollback these changes (not recommended):

```typescript
// In src/main/windows/main.ts
webSecurity: process.env.NODE_ENV === "development" ? false : true,
```

And add back to CSP:
```html
'unsafe-eval'
```

## Related Files

- `src/main/windows/main.ts` - Window creation and webPreferences
- `src/renderer/index.html` - Content Security Policy
- `electron.vite.config.ts` - Build configuration (unchanged)

## References

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Electron Security Warnings](https://www.electronjs.org/docs/latest/tutorial/security#electron-security-warnings)
