# Greek and English

Use the **EN / EL** button in the app header, sign-in/authorization screens or a
form's dialog header. Greek remains the default. The choice is kept on this device
under `nutrition-tracker-language` in localStorage and synchronized across tabs.
If preference storage is blocked, switching still works for the current page.
No SQL migration, new environment variable or MCP reconnection is required.

English covers navigation, the diary, weekly balance, weight history, targets,
favorites, meal/workout forms, confirmation dialogs, errors, notices, account
connections, OAuth consent and the privacy page. `html.lang` follows the selection.
Dates and numbers use el-GR or en-GB; tracking remains in Europe/Athens and weeks
still run Monday–Sunday. Native browser date-picker/validation controls follow the
browser or operating system's own language settings.

User-entered meal/workout names and app names are displayed as stored. Meal
categories retain the existing Greek database/API values. Only their displayed
labels are translated; every option has an explicit value. Language switching
never changes the write payload, macros, targets, ownership or idempotency rules.
Unsubmitted forms and target edits survive switching in either direction.

## Maintaining translations

- `src/i18n.js` owns the supported locales, preference store, subscriptions and
  plain-text `t(source, values, language)` helper. `src/i18n-react.jsx` exposes the
  React external-store subscription. No translation runtime dependency is added.
- Greek source messages are catalog keys. Add the English value in
  `src/translations/en.js`, retaining all `{placeholder}` names. Components call
  `useLanguage()` to update when the preference changes, and `t()` at render time.
- Keep source messages in feedback/error state so an existing message can be
  translated when the language changes. Do not store the translated result there.
- Keep user content separate from UI messages. Translate category labels, never
  their stored values. Format numbers/dates using `src/display.js` helpers.
- `public/privacy.html` is a static public page with both versions and the same
  preference key; `?lang=en` or `?lang=el` selects the linked app language.

## Verification

`npm test`, `npm run build`, `npm run test:browser`.

Tests cover catalog interpolation, English/Greek date and number formatting,
Athens calendar boundaries, preference notifications and blocked-storage fallback.
The browser suite checks English login errors, all four dashboard views, visible
translation coverage, width sweeps, changing language inside a populated draft,
canonical category persistence through PostgreSQL, saved notifications, unsaved
target edits, reload persistence, cross-tab synchronization, privacy and OAuth
consent. Existing Greek workflows, macro/fueling calculations, mutations, OAuth
account controls and zoom checks remain in the same suite. Supabase HTTP/OAuth is
simulated over actual local PostgreSQL fixtures; this is not live deployment proof.

Optional captures:
`NUTRITION_SCREENSHOT_DIR=/tmp/nutrition-english npm run test:browser`.
