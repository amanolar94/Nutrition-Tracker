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
  open the corresponding day's diary. Weekly averages explicitly include all seven
  days; an unlogged day is not represented as proof of zero food intake.
- Actual weight records drive the graph and change from the first measurement;
  the 100 kg starting reference is not fabricated into history.
- Target edits remain while navigating or refreshing. Untouched fields merge with
  updated server data to avoid overwriting changes from another device.
- Refresh feedback, readable full macro names, 44px touch targets, native focus-trapped
  dialogs, keyboard tab navigation, skip link, and reduced-motion handling improve
  accessibility. Credential/setup controls are in Settings, away from daily results.

No SQL migration, MCP tool schema or authentication configuration changes are needed.

Verification: npm test; npm run build; npm run test:browser. Browser tests use real
PostgreSQL fixtures behind a simulated Supabase HTTP bridge, not live personal data.
They exercise all four views at 320/375/390/768/1280, keyboard navigation, calendar
changes, week drilldown, canceling dialogs without writes, manual persistence/deletion,
MCP record refresh, weights/targets and unsaved-goal preservation. Optional screenshots:
NUTRITION_SCREENSHOT_DIR=/tmp/nutrition-ux npm run test:browser.
