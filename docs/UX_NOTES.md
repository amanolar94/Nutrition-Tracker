# Dashboard usability update

The site is the results/inspection interface; ChatGPT remains the primary input.

Patterns used as references: MyFitnessPal's daily diary and consumed/goal comparison,
Cronometer's nutrient breakdown and meal grouping, and MacroFactor's separate
progress view. This is an independent design, not copied brand assets or a claim
that their latest live screens were reviewed. Their official sites were unreachable
from this cloud environment during the task.

- Day, Week, Progress and Settings are separate views. Navigation is at the bottom
  on mobile and above the content on desktop; hash navigation supports browser back.
- Calories lead the daily overview; three macro cards show consumed/target with
  labels and units. Excess is reported neutrally as above target. Unknown legacy
  values are identified rather than portrayed as measured zero.
- Meals are grouped into existing categories. Workout fuel remains distinct and
  already included in totals. The manual form opens on demand in a native dialog.
- Previous/next day and native date picker work with the Athens calendar. Week bars
  open the corresponding day's diary. UI averages use days with recorded meals; unlogged days are excluded. The legacy
  API daily_average is retained for compatibility, alongside recorded_day_average.
- Actual weight records drive the graph and change from the first measurement;
  the 100 kg starting reference is not fabricated into history.
- Target edits remain while navigating or refreshing. Untouched fields merge with
  updated server data to avoid overwriting changes from another device.
- Refresh feedback, readable full macro names, 44px touch targets, native focus-trapped
  dialogs, keyboard tab navigation, skip link, and reduced-motion handling improve
  accessibility. Connected app access lives in Settings → Account. The old ChatGPT
  instruction card and retired personal-key controls are removed; only current app
  connections and their access-removal action are shown.

The follow-up review used the user's trifuel screen recording (empty diary/history,
meal library and mobile library). It informed compact summary cards, diary filters,
favorites and comparison of both target sets. This is a visual reference, not verified
reference backend behavior. ChatGPT remains the primary input, with one explicit
confirmation before writes. Mobile bottom navigation is retained.

The latest update requires the additive 20261020_diary_usability.sql migration;
MCP 3.2.0 adds five tools, optional meal_time, and saved day types in summaries.
See DIARY_USABILITY.md. No OAuth or environment-variable changes are needed.

Verification: npm test; npm run build; npm run test:browser. Browser tests use real
PostgreSQL fixtures behind a simulated Supabase HTTP bridge, not live personal data.
They exercise all four views at 320/375/390/768/1280, keyboard navigation, calendar
changes, week drilldown, canceling dialogs without writes, manual persistence/deletion,
MCP record refresh, weights/targets, unsaved-goal preservation and connected-app
revocation (including failure/retry). Optional screenshots:
NUTRITION_SCREENSHOT_DIR=/tmp/nutrition-ux npm run test:browser.

Desktop control follow-up: selects reserve room for their arrow and use a pointer
cursor; native summary sections align their label/chevron on one row. The date
caption and calendar icon form one click target. Native date inputs use showPicker
for whole-field clicks and Enter/Space, retaining normal behavior on browsers
without that API. The browser smoke test exercises actual native picker invocation
from the desktop date caption, keyboard and workout date field, plus the existing
mobile/zoom coverage. No migration or MCP connection refresh is required.
