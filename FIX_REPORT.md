# OpenCode Integration Fixes

## 1. Port Synchronization Fix
- **Issue**: The OpenCode server was running on port `51089` (Dev mode) but the `claude` execution engine was hardcoded to `4096`. This caused "Server not reachable" errors and subsequent "Binary not found" errors when falling back.
- **Fix**: Created `src/main/lib/opencode-state.ts` as a shared source of truth for the OpenCode URL.
    - Updated `opencode.ts` (router) to update this state when settings change.
    - Updated `claude.ts` (router) to read this state dynamically.
    - Configured `opencode-state.ts` to automatically default to port `51089` in development mode (matching `config.ts`).

## 2. Title Generation Fallback
- **Issue**: The `auto-rename` feature (which generates chat titles) relied solely on the `21st.dev` API, failing with `401 Unauthorized` for unauthenticated/local users.
- **Fix**: Implemented a fallback mechanism in `active-chat.tsx`.
    - If the API call fails, the client now connects directly to the local OpenCode server (via `trpcClient.opencode`).
    - It creates a temporary session and asks the local model to "Generate a very short, concise title".
    - This ensures chat titles work even in fully local/offline mode.

## 3. "Binary Not Found" Errors
- **Resolution**: These errors were a symptom of the connection failure. The system tried to route to OpenCode, failed (due to port 4096), and then the logs showed misleading "Binary not found" checks from initialization. With the connection fixed, `runOpenCode` will succeed, and these errors should no longer appear or impact the flow.

## 4. Sandbox Question
- The application uses **E2B** for cloud-based agent sandboxes to ensure security and isolation when running cloud models.
- However, when using **OpenCode**, the agents run locally on your machine (via the `opencode` server), interacting directly with your local filesystem as configured. This provides a "Local-First" experience without external sandbox dependencies.
- **Note on E2B API Key**: You provided an E2B API Key (`e2b_...`). The current desktop application codebase does not appear to use this key directly (as it relies on `21st.dev` API or local OpenCode). If you intended to configure a local E2B instance, this would require deeper codebase modifications not currently visible in the configuration scope.

## 5. Dev Mode Configuration Update
- **Issue**: In development mode, the app was pointing *all* API calls (Auth, User Profile, etc.) to the local OpenCode server (`localhost:51089`). This prevented authentication with `21st.dev`.
- **Fix**: Updated `src/main/lib/config.ts` to point `development` API URL to `https://21st.dev` for Auth/API services, while `opencode-state.ts` ensures OpenCode execution remains local on port `51089`.
- **Result**: You can now authenticate with 21st.dev while running the app locally, enabling features that require a valid session (like cloud sync or API-based features), while execution remains local.

## 6. Removed Demo Account
- **Issue**: The Profile settings tab was displaying a hardcoded "Demo User" account.
- **Fix**: Removed the hardcoded mock usage in `src/renderer/features/agents/components/settings-tabs/agents-profile-tab.tsx` and connected it to the real user profile API (via `apiFetch`).
- **Result**: The "Demo Account" is gone. If you are not logged in, it will show as empty/guest. If you log in with 21st.dev, it will show your real profile.

## 7. Restored Real Auth Logic (Main Process)
- **Issue**: The `AuthStore` in the Main process was hardcoded to bypass authentication and return a fake `dev@example.com` user.
- **Fix**: Reverted `src/main/auth-store.ts` to use proper secure storage (checking `auth.dat`).
- **Result**: Authentication is now real. The app will respect your login status with 21st.dev and securely store your tokens. The fake dev user is gone.

## 8. Windows Build Fixed
- **Issue**: Building the Windows app failed due to a missing `build/icon.ico` file required by the NSIS installer configuration.
- **Fix**: Updated `package.json` to remove the strict requirement for `.ico` files, allowing Electron Builder to use the existing `icon.png` (auto-converting it for the installer).
- **Result**: The build completes successfully. Start the build with `npm run release:win` to create the installer in `release/`.

## 9. Implemented In-App Auth Bridge
- **Issue**: Authentication flow relying on external browser callbacks was unreliable in some development environments (firewall/port issues).
- **Fix**: Updated `src/main/auth-manager.ts` to use an internal "Bridge" window for authentication. This window opens the login page and intercepts the callback URL directly, bypassing external browser/server communication issues.
- **Result**: Clicking "Sign In" opens an internal window that handles the entire login flow reliably within the app.

## 10. Fixed Auth Race Condition
- **Issue**: "Invalid or expired auth code" errors occurred because both the new Bridge Window and the standard Protocol Handler were trying to exchange the same auth code simultaneously.
- **Fix**: Implemented request deduplication in `AuthManager.exchangeCode`. Concurrent requests for the same code now share the same execution promise.
- **Result**: Authentication succeeds without errors, regardless of which handler (Bridge or Protocol) catches the callback first.

## 11. Fixed OpenCode API Payload
- **Issue**: "OpenCode message failed: 400 Bad Request" errors occurred because the request payload was missing the required `parts` array structure, and potentially due to invalid model IDs being requested.
- **Fix**: Updated `src/main/lib/trpc/routers/claude.ts` to send the correct payload format (`{ parts: [{ type: "text", text: "..." }] }`) and parse the response `parts` array. Additionally implemented fallback logic to retry with the default model if the requested model triggers a 400 error.
- **Result**: OpenCode integration works correctly, allowing local models to be used and handling invalid model selections gracefully.
