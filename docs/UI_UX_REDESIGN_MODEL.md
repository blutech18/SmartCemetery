# Smart Cemetery UI/UX Redesign Model

**Document status:** Proposed implementation blueprint  
**Prepared:** 2026-07-18  
**Scope:** Public website, kiosk, shared application shell, and Admin, Staff, and Client experiences  
**Primary objective:** Turn the current functional interface into a consistent, accessible, responsive, production-grade civic service platform without changing established business rules.

## 1. Executive direction

The redesign should feel calm, respectful, trustworthy, and operationally efficient. It must not resemble a generic neon analytics template or use decoration that competes with cemetery records and visitor tasks. The visual direction is **“civic calm”**: restrained dark surfaces, clear hierarchy, high-contrast text, meaningful status color, subtle elevation, and data visualization that answers a decision rather than merely filling space.

The target experience has one design language across public, kiosk, and authenticated routes; one reusable component system; role-specific dashboards; predictable loading, empty, error, success, and permission states; accessible desktop and mobile interactions; and privacy-safe analytics.

### Success outcomes

- Admins can identify capacity, backlogs, data-quality risks, and operational trends within 30 seconds.
- Staff begin from a prioritized work queue rather than a generic system overview.
- Clients immediately see personal requests, notifications, search, and directions—not internal operational data.
- Every action has a consistent label, visual priority, size, state, and confirmation pattern.
- Every dashboard remains useful with no data, partial data, slow data, or failed data.
- Core journeys remain usable at 320 px, tablet, desktop, and kiosk dimensions.
- New UI meets WCAG 2.2 AA targets and preserves current RBAC, encryption, archival, routing, and privacy rules.

## 2. Evidence reviewed

The model is based on the current Next.js App Router implementation, including:

- Shell and access: `src/app/layout.js`, `src/app/dashboard/layout.js`, `src/components/DashboardSidebar.js`, `src/components/DashboardHeader.js`, `src/components/Providers.js`, `src/proxy.js`, and `src/lib/route-access.js`.
- Styling: `src/app/globals.css` and `src/app/public.css`.
- Public routes: `src/app/page.js`, `src/app/search/page.js`, `src/app/kiosk/page.js`, and `src/app/login/page.js`.
- Dashboard routes: the root dashboard plus analytics, broadcasts, feedback, graves, locations, map, notifications, plots, reports, requests, search, users, and verification pages.
- Maps: `src/components/CemeteryMap.js`, `src/components/MapPicker.js`, and `src/components/NavigationOverlay.js`.
- Product and mapping authority: `docs/manuscript.md`, which defines Google Maps API as the proposed system's interactive map renderer across web, mobile, and kiosk.
- Data/capabilities: reporting, analytics, requests, notifications, feedback, verification, navigation, `package.json`, role/public/kiosk Playwright coverage, `docs/Smart_Cemetery.md`, and `docs/IMPLEMENTATION_AUDIT.md`. Where mapping guidance conflicts, `docs/manuscript.md` takes precedence.

Generated output, dependencies, environment files, lockfiles, database backups, and unrelated backend internals were excluded.

## 3. Current-state assessment

### What should be preserved

- Complete role journeys already exist for Admin, Staff, and Client.
- Public search, phonetic suggestions, kiosk routing, privacy-safe navigation logging, reports, exports, verification, notifications, feedback, and operational workflows are implemented.
- The codebase already includes Lucide icons, Sonner, Recharts, responsive Playwright coverage, and useful color/spacing/radius tokens.
- The dashboard has recognizable page headers, cards, badges, tables, forms, skeletons, and mobile navigation.
- Existing dark styling is appropriate for a controlled operational interface and can evolve without a framework change.

### Problems the redesign must solve

| Area | Current issue | Target correction | Priority |
|---|---|---|---|
| Role dashboards | `/dashboard` gives largely the same operational statistics and quick actions to every role | Separate Admin, Staff, and Client information architecture and data contracts | P0 |
| Visual system | Dashboard and public pages use different dark/glass languages, with many hard-coded values | One semantic token system consumed by all surfaces | P0 |
| Components | Cards, buttons, filters, states, and dialogs are mostly CSS conventions or route-local markup | Reusable UI primitives with documented variants | P0 |
| Actions | Button shapes, widths, colors, icon sizes, and mobile behavior vary | A strict action hierarchy and 44 px minimum targets | P0 |
| Dashboard data | Analytics is rendered primarily as cards and tables although Recharts is installed | Decision-focused, accessible charts plus tabular alternatives | P1 |
| Responsive UI | Inline styles and blanket mobile full-width buttons produce brittle toolbars and tables | Mobile-first component-level layout contracts | P0 |
| Accessibility | Drawer/dialog focus behavior, active navigation semantics, loading announcements, and table semantics are incomplete | WCAG 2.2 AA interaction and state requirements | P0 |
| Feedback states | Loading, errors, empty results, retry, success, and permission messages differ by page | Shared state components and copy patterns | P0 |
| Role loading | Sidebar defaults to Client before the session resolves | Authenticated shell skeleton; render role IA only after resolution | P0 |
| Maps | Google Maps API is the approved renderer and the current component already uses `@react-google-maps/api`, but some interface copy still says OpenStreetMap | Standardize all map copy, states, and redesign specifications around Google Maps API | P0 |
| Maintainability | Extensive route-level inline styles and global selectors create visual drift | Incremental extraction into components and scoped styles | P1 |
| Motion/fonts | Decorative motion lacks a complete reduced-motion strategy; fonts are remotely imported in global CSS | Reduced-motion support and framework-managed/local font delivery | P1 |

### Explicit non-goals

- Do not change archival, encryption, authorization, routing privacy, or plot occupancy rules.
- Do not add payments, image recognition, drones, blockchain, or other out-of-scope capabilities.
- Do not replace Next.js, React, the existing API layer, or the current JavaScript codebase as part of visual work.
- Do not add another icon, chart, toast, form, or component library before evaluating installed tools.
- Do not expose private operational totals or other users’ activity on the Client dashboard.

## 4. Users and top tasks

### Public visitor

Find a grave quickly, understand close spelling matches, see location details, and open an accessible route. The interface must be understandable without an account or training.

### Kiosk visitor

Complete search and navigation on a large touch display, recover from denied location access, and leave no previous visitor’s data behind. Reset and inactivity behavior must be prominent and reliable.

### Client

Search records, get directions, submit and track personal requests, read notifications, and send feedback. The dashboard should communicate personal status and next steps, not internal cemetery administration.

### Staff

Work through incomplete records, verify information, monitor plots, process assigned/open requests, and assist visitors. The dashboard should prioritize queues, aging, and blockers.

### Admin

Monitor capacity and service health, manage records/layout/users, review queues, publish announcements, inspect trends, and export reports. The dashboard should highlight exceptions and decisions, not only totals.

## 5. Target information architecture

### Navigation model

Use one authenticated application shell with a role-aware sidebar. Group items rather than presenting a long flat list.

**Admin groups**

1. Overview: Dashboard, Analytics, Reports
2. Cemetery records: Graves, Plots, Locations, Map, Verification
3. Service operations: Requests, Notifications, Broadcasts, Feedback
4. Administration: Users

**Staff groups**

1. Overview: Dashboard
2. Daily work: Verification, Requests
3. Cemetery records: Graves, Plots, Map
4. Communication: Notifications, Feedback

**Client groups**

1. Overview: Dashboard
2. Find and navigate: Search, Map
3. My services: My Requests, Notifications
4. Support: Feedback

On desktop, groups may be collapsible but the active group must remain open. On mobile, use an accessible drawer with focus containment, Escape-to-close, focus return, body-scroll lock, `aria-expanded`, `aria-controls`, and a semantic close button. Active links use `aria-current="page"`. Do not render Client links as a session-loading fallback.

### Route and role matrix

| Route | Admin | Staff | Client | Primary redesign purpose |
|---|:---:|:---:|:---:|---|
| `/dashboard` | Yes | Yes | Yes | Role-specific command center |
| `/dashboard/graves` | Yes | Yes | No | Searchable record workspace |
| `/dashboard/plots` | Yes | Yes | No | Capacity and plot status workspace |
| `/dashboard/locations` | Yes | No | No | Location lifecycle and hierarchy |
| `/dashboard/map` | Yes | Yes | Yes | Role-aware map tools and directions |
| `/dashboard/requests` | Yes | Yes | Yes | Operations queue or personal request tracker |
| `/dashboard/notifications` | Yes | Yes | Yes | Role-scoped inbox |
| `/dashboard/broadcasts` | Yes | No | No | Announcement composition and delivery history |
| `/dashboard/analytics` | Yes | No | No | Privacy-safe operational trends |
| `/dashboard/verification` | Yes | Yes | No | Prioritized data-quality queue |
| `/dashboard/users` | Yes | No | No | User and role administration |
| `/dashboard/feedback` | Yes | Yes | Yes | Review workspace or personal submission |
| `/dashboard/reports` | Yes | No | No | Formal reporting and exports |
| `/dashboard/search` | No | No | Yes | Authenticated search and navigation |

Hidden navigation is not authorization. Direct route access and all APIs must continue to enforce role rules independently.

## 6. Visual design system

### Design principles

1. **Respectful before decorative:** content and wayfinding outrank visual effects.
2. **Operational clarity:** use density where it helps scanning, never to compress touch targets.
3. **Meaningful color:** reserve strong color for status, focus, and high-priority actions.
4. **Progressive disclosure:** show summary first, detail and secondary actions on demand.
5. **Stable layouts:** loading and refreshed data should not cause avoidable movement.
6. **Accessible by default:** semantics, keyboard behavior, contrast, and state text are component requirements.

### Semantic color model

Retain a dark-first direction, but rename raw palette variables into semantic roles. Values must be contrast-tested before implementation.

- `--color-canvas`: application background
- `--color-surface-1`: standard panel/card
- `--color-surface-2`: elevated or selected surface
- `--color-surface-interactive`: hover/pressed surface
- `--color-border-subtle`, `--color-border-strong`, `--color-focus`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-on-accent`
- `--color-action-primary`, `--color-action-primary-hover`
- `--color-success`, `--color-warning`, `--color-danger`, `--color-info`
- paired status background/border/text tokens for every semantic status

Use blue as the main interactive accent, green for success/availability, amber for warning/pending, red for destructive/error states, and slate neutrals for structure. Status meaning must also appear in text or iconography. Avoid large glowing gradients and excessive glass blur.

### Typography

- Use one framework-managed or local sans-serif family; remove the remote `@import`.
- Page title: 28–32 px desktop, 24–28 px mobile, 700 weight.
- Section title: 18–20 px, 600–700 weight.
- Body: 14–16 px with at least 1.5 line height.
- Supporting/metadata text: never below 12 px; use 13–14 px where possible.
- Use tabular numerals for KPIs, dates, counts, and report tables.
- Avoid uppercase labels for long text; reserve it for short metadata where spacing remains readable.

### Spacing, radius, elevation, and density

Use the existing 4/8-based scale, but apply it through components rather than route-level literals. Standard card padding is 20–24 px desktop and 16 px mobile. Standard grid gaps are 16–24 px. Use 8–12 px control radius and 12–16 px panel radius; reserve pills for status, compact filters, and tags. Static cards must not lift on hover. Only clickable cards receive hover, focus, and pressed states.

### Motion

- Fast control feedback: 120–180 ms.
- Drawer/dialog transitions: 180–240 ms.
- Chart entrance, if used: no more than 300 ms and never required to understand data.
- Implement `prefers-reduced-motion: reduce`; remove mesh pulsing, large translation, smooth scrolling, and nonessential chart animation when requested.

## 7. Core component contract

Create primitives under `src/components/ui/` and composed dashboard elements under `src/components/dashboard/`. Keep business logic in route/domain code and pass data/actions into presentation components.

### Buttons

| Variant | Use | Style rule |
|---|---|---|
| Primary | One main completion action per region | Solid brand fill, high contrast |
| Secondary | Important alternative | Quiet surface with visible border |
| Ghost | Low-priority toolbar/navigation action | Transparent until hover/focus |
| Destructive | Delete/deactivate/reject | Red treatment; confirmation required |
| Link | Inline navigation | Underline or clear text-link affordance |
| Icon | Compact named action | 44×44 minimum, tooltip, accessible name |

All buttons need default, hover, focus-visible, active, disabled, and loading states. Loading retains the label where space permits and sets `aria-busy`. Do not use a visual Primary style that resembles a transparent secondary action. Mobile buttons become full-width only in forms or deliberately stacked action groups—not globally.

### Forms

Provide shared `Field`, `Label`, `Input`, `Select`, `Textarea`, `FieldHint`, and `FieldError` patterns. Errors are connected with `aria-describedby`; required state is explicit; validation occurs without clearing user input. Search uses a dedicated component with submit, clear, loading, and no-results behavior. Date range controls include Apply and Reset semantics and a readable active-range summary.

### Cards and KPIs

- `Panel`: static container with no hover transform.
- `ActionCard`: keyboard-focusable navigation/action with hover and pressed states.
- `KpiCard`: label, value, comparison/context, optional icon, and destination.
- `ChartCard`: title, description, controls, visualization, summary, and table fallback.
- `QueueCard`: count, severity/age, top items, and “View all.”

KPI deltas must identify the comparison period (“12% vs previous 30 days”), not show an unexplained arrow.

### Data tables

Use a reusable `DataTable` composition with caption, search/filter region, results count, column headers with `scope`, pagination, row selection where justified, status badges, empty/error/loading states, and an overflow menu for secondary actions. Avoid more than two visible row actions. On narrow screens, use prioritized columns plus a detail drawer/card view rather than forcing the entire desktop table into a tiny viewport.

### Dialogs, drawers, alerts, and toasts

Replace route-specific modal markup and browser `alert()`/`confirm()` with shared accessible patterns. Dialogs require title/description associations, initial focus, focus trap, Escape handling, focus return, scroll containment, and explicit cancel/action buttons. Destructive dialogs name the object and consequence. Use Sonner for short noncritical success feedback; use inline alerts for errors that need action or context.

### Required state components

Every data region defines:

- Skeleton/loading state with a status announcement
- First-use empty state with a primary next action
- Filtered-empty state with “Clear filters”
- Error state with a safe message and Retry
- Permission-denied state with a route back to allowed content
- Offline/network-interrupted state where appropriate
- Success state and mutation progress
- Stale/refreshing state without replacing readable content

## 8. Shared application shell

### Desktop

Use a 264–280 px sidebar, a compact top bar, and a centered content container up to roughly 1440 px. The top bar contains the current section/breadcrumb on the left and notification/profile actions on the right. Avoid duplicating the full page title in both the top bar and body.

### Mobile/tablet

Use a sticky 56–64 px top bar and drawer navigation. Page actions wrap into a deliberate action row or overflow menu. Filters become a compact summary plus filter drawer when the full filter bar does not fit. Preserve at least 16 px page gutters.

### Page template

Every authenticated page follows:

1. Breadcrumb when hierarchy adds value
2. Page title and one-sentence purpose
3. Primary and secondary actions
4. Optional context/filter bar
5. Summary or task-critical content
6. Main table/chart/workspace
7. Supporting detail
8. Complete states and help/recovery copy

## 9. Role-specific dashboard models

### 9.1 Admin command center

**Purpose:** Surface capacity, backlogs, data quality, and service performance.

**Header**

- “Cemetery operations” title and current date range
- Last-updated text and refresh action
- Primary action: Add grave record
- Secondary actions: Add plot, Create broadcast, Export report

**Top KPI row**

1. Plot occupancy: occupied / total, rate, available count
2. Open requests: pending plus oldest age
3. Verification backlog: incomplete records plus missing-GPS count
4. Service signal: unread/critical feedback or average rating with response count

**Main grid**

- **Occupancy by location:** horizontal bar chart, sorted by occupancy, with available/occupied segments and a table alternative. Clicking a location opens filtered plots.
- **Request trend and throughput:** 30-day line/area chart showing received and completed requests; include median resolution time only if the backend can compute it correctly.
- **Operational queue:** oldest pending requests, verification blockers, unplaced plots, and failed/retry-required operations. Show severity and age.
- **Navigation usage:** weekly route events and channel breakdown using privacy-safe aggregates already available from `/api/analytics`.
- **Recent administration:** meaningful audit actions, not raw noisy logs; link to the detailed analytics/report view.
- **Capacity watchlist:** locations nearing a documented threshold. The threshold must be configurable or clearly defined, not silently hard-coded in UI.

**Admin chart rules**

- Default range: last 30 days; options 7, 30, 90 days and custom range.
- One global date filter may control trend cards; inventory snapshots must be labeled “current” rather than implying they follow the range.
- Do not combine counts with percentages on one unlabeled axis.
- No chart may hide a zero or no-data state.

### 9.2 Staff work dashboard

**Purpose:** Start the day from prioritized tasks and quickly assist visitors.

**Header actions:** Search grave, Open map, Add/encode record only if current RBAC permits it.

**Top KPI row**

1. Records awaiting verification
2. Records missing GPS
3. Open requests visible to Staff
4. Available plots / plot issues relevant to Staff

**Main grid**

- **Today’s work queue:** actionable records sorted by urgency/age with Verify, Review, or Locate actions.
- **Verification throughput:** 7/30-day line or bar chart of verified vs rejected records, provided a trustworthy timestamped aggregate is added.
- **Request status:** stacked bar or compact distribution for pending, in progress, completed, rejected.
- **Visitor assistance panel:** prominent grave search and map shortcut; optional recent assistance count only if privacy-safe event data supports it.
- **Data-quality alerts:** missing burial identifiers, GPS, or plot associations with clear links to filtered lists.

The Staff dashboard must not include user administration, broadcasts, global audit logs, or export controls reserved for Admin.

### 9.3 Client service dashboard

**Purpose:** Show personal progress and make search/navigation the fastest actions.

**Hero action:** a focused “Find a grave” search field with Search and Open map options.

**Top summary row**

1. Active requests owned by the user
2. Requests needing user action, if that state exists
3. Unread notifications
4. Completed requests in the selected recent period

**Main grid**

- **Request progress:** timeline/list for the latest personal requests with reference ID, status, last update, and next expected action.
- **My request activity:** a small six-month bar chart or status distribution based only on the signed-in user’s requests. When volume is too low, replace the chart with a clear summary rather than rendering meaningless graphics.
- **Recent notifications:** latest relevant announcements and request updates with read state.
- **Quick services:** Submit request, Track by reference, Search records, Get directions, Send feedback.
- **Help card:** concise explanation of search spelling suggestions, location permission, and how request tracking works.

Do not show total graves, system users, global feedback ratings, global requests, or internal operational analytics to Clients.

### 9.4 Dashboard data contract

Prefer a role-aware aggregate endpoint or server-side composition so the first dashboard does not trigger many independent client fetches. The contract should return only fields allowed for the authenticated role.

**Can be reused now**

- `/api/reports/stats`: grave, plot, request, feedback, location, and user summaries
- `/api/analytics`: audit totals, navigation by day, channels, and coarse destinations
- Existing requests, notifications, feedback, plots, locations, and incomplete-record endpoints

**Likely aggregate additions**

- Time-series request received/completed counts and resolution metrics
- Verification throughput and aging
- Occupancy grouped by location
- Role-safe queue summaries
- Client-owned monthly request/status summary
- Unread notification count

Every metric in implementation must document: definition, role visibility, source, time zone, date range behavior, empty behavior, and drill-down target. Never fabricate sample production values outside development fixtures.

## 10. Analytics and visualization model

Use the installed Recharts package; do not add a second chart library. Create reusable wrappers that provide responsive sizing, consistent axes/grid/tooltips, loading and empty states, an accessible summary, and a data-table alternative.

| Question | Preferred visualization | Avoid |
|---|---|---|
| How is a measure changing? | Line or area chart | Pie chart over time |
| How do locations compare? | Sorted horizontal bar | Dense radar chart |
| What is the status composition? | Stacked bar; donut only for few categories | Many tiny slices |
| Where is capacity at risk? | Progress/bullet bars plus exact values | Color-only heat map |
| What requires action now? | Queue/list/table | Decorative chart |

Chart colors must remain distinguishable under common color-vision deficiencies. Tooltips cannot be the only way to obtain values. Each chart card includes a one- or two-sentence text insight generated from the same data, without making unsupported predictions.

## 11. Route-level redesign requirements

### Public home

Unify it with the core tokens, reduce decorative mesh/blur, preserve the strong search-first flow, add concise service explanation and “How to locate a grave” steps, and make Staff/Admin login discoverable without competing with the visitor action. Avoid marketing claims such as “state-of-the-art”; use clear civic-service language.

### Public and authenticated search

Use one shared result-card/search component with context-specific actions. Add an explicit input label, result count, search term summary, spelling-suggestion explanation, retry state, and keyboard-visible result actions. On mobile, stack metadata and actions without squeezing status badges.

### Kiosk

Provide large persistent Search, Start over, Directions, and accessibility controls. Define idle reset and confirmation, clear all visitor-specific state, and prevent prior query/destination visibility. Design for touch first and provide map-independent step text.

### Login

Simplify the decorative left panel, keep credential errors generic, enlarge the password visibility control to 44 px, provide visible error feedback in addition to screen-reader text, and make submitting/loading status stable. Retain no credential examples that look like real production access.

### Graves, plots, locations, and users

Use a consistent resource-page template: title/actions, summary, search/filter bar, results count, table, pagination, row action menu, and create/edit dialog or drawer. Preserve filters after mutations and return focus to the initiating control. Bulk actions should only be introduced when backend authorization and transactional behavior are explicit.

### Requests, verification, feedback, and notifications

Treat these as queues/inboxes rather than generic tables. Add status tabs or filters with counts, age/updated metadata, ownership/context, priority cues that are not color-only, detail drawers, and explicit next actions. Client views remain scoped and use timeline language; operational views emphasize age and handling state.

### Map

Use a full workspace layout: map as the primary canvas, a searchable/list panel, selected-plot details, directions, and role-specific edit tools. On mobile use map/list tabs or a bottom sheet rather than stacking an enormous map above all controls. Always offer textual destination and direction information. Map errors, missing GPS, routing timeout, denied geolocation, and out-of-bounds placement each need distinct recovery copy.

### Analytics and reports

Analytics becomes interactive exploration with trends and drill-downs; Reports remains formal summaries and exports. Avoid duplicating identical content across both pages. Export actions use a menu when space is constrained and clearly state active date filters.

### Broadcasts

Use a guided composer with audience summary, character/content guidance, preview, send confirmation, delivery progress, and delivery history. Prevent accidental duplicate sends while a mutation is pending.

## 12. Responsive layout specification

Use content-driven breakpoints close to existing conventions, not device names alone:

- Compact: below 640 px
- Standard mobile/large phone: 640–767 px
- Tablet: 768–1023 px
- Desktop: 1024–1439 px
- Wide operations display: 1440 px and above
- Kiosk: explicit layout mode tested at deployed dimensions

Rules:

- Four KPI cards become two columns on tablet and one column only when content cannot remain readable.
- Dashboard chart grids use 8/4 or 7/5 desktop spans, then one column below tablet.
- Filter bars wrap predictably; compact screens use a filter drawer and active-filter chips.
- Tables preserve priority columns; secondary information moves into expandable rows/cards.
- Dialogs become near-full-screen sheets on compact screens, with sticky action footers.
- Never rely on hover for discovery or operation.
- Keep touch targets at least 44×44 px with adequate separation.
- Kiosk targets should generally be larger than mobile minimums.

## 13. Accessibility acceptance model

The redesign targets WCAG 2.2 AA.

- Add a skip link and landmarks for header, navigation, main content, and complementary panels.
- Maintain logical heading order; one clear `h1` per page.
- All controls have programmatic names; icon-only actions also have tooltips.
- Focus-visible rings meet contrast and are never removed without replacement.
- Drawer, dialog, popover, and menu keyboard behavior is complete.
- Loading, success, filtering results, and errors use appropriate live regions without excessive announcements.
- Tables have captions or accessible names, scoped headers, and sort state.
- Charts include title/description, text summary, and accessible data table.
- Status is never communicated only by color.
- Text and UI contrast are tested against actual surfaces, including overlays and maps.
- Support 200% zoom, text spacing, reflow at 320 CSS px, and reduced motion.
- Geolocation and map functionality has non-map explanations and recovery paths.
- Destructive actions explain impact and permit cancellation.

## 14. Content design

Use plain, respectful, task-based language.

- Button labels start with verbs: “Add grave record,” “Verify record,” “Export report,” “Send announcement.”
- Avoid ambiguous “Submit,” “OK,” or “Manage” when the action can be named.
- Use consistent statuses: Pending, In progress, Completed, Rejected; Active, Archived; Available, Occupied, Unavailable; Incomplete, Verified, Rejected. Backend values can remain unchanged while labels are normalized.
- Dates use one locale-aware display format and expose exact timestamps where recency matters.
- Empty states explain why there is no content and what action is possible.
- Errors explain what failed, what remained safe, and what the user can do next without leaking security details.
- Confirmation text names the record or location and whether the action can be reversed.

## 15. Privacy and security UX

- Preserve server-side role checks; navigation visibility is convenience only.
- Client dashboards use owner-scoped aggregates exclusively.
- Navigation analytics remain coarse; exact user origin stays in memory and is never shown in admin charts.
- Exports state their scope/date range and must retain authorization checks.
- Session expiry should preserve non-sensitive draft context where safe, then return the user to the intended route after authentication.
- Kiosk reset clears search, route, geolocation-derived state, selected records, and history-visible details.
- Permission errors distinguish “not signed in” from “not allowed” without exposing protected object existence.

## 16. Performance and implementation architecture

- Keep the existing stack. Reuse Recharts, Lucide, and Sonner.
- Prefer server-rendered shell/content where compatible with the actual Next.js 16.2 guidance; keep only interactive regions as client components.
- Consult `node_modules/next/dist/docs/` before implementation because this repository’s Next.js version has breaking conventions.
- Lazy-load map and heavy chart regions when they are below the initial priority content.
- Use stable skeleton dimensions to reduce layout shift.
- Replace the remote font CSS import with the supported framework font approach or a local asset.
- Avoid broad `transition: all`, expensive persistent backdrop filters, and animated full-screen meshes.
- Aggregate dashboard data server-side where this reduces request waterfalls without broadening access.
- Keep chart payloads bounded and aggregated; do not send raw audit or navigation records merely to compute totals in the browser.

### Proposed component inventory

```text
src/components/
  ui/
    Button.js
    IconButton.js
    Field.js
    Badge.js
    Alert.js
    Dialog.js
    Drawer.js
    EmptyState.js
    DataTable.js
    Pagination.js
    Skeleton.js
  dashboard/
    DashboardShell.js
    PageHeader.js
    FilterBar.js
    KpiCard.js
    ChartCard.js
    QueueCard.js
    RoleDashboard.js
  charts/
    TimeSeriesChart.js
    HorizontalBarChart.js
    StatusDistributionChart.js
    AccessibleChartTable.js
```

This is a target organization, not a requirement to create all files at once. Extract a primitive only when the first migrated surface needs it, then reuse it on subsequent routes.

### Styling migration

1. Normalize semantic tokens in `globals.css` while keeping aliases for existing variables.
2. Implement primitives against semantic tokens.
3. Make `public.css` consume shared tokens and remove duplicated raw values.
4. Remove invalid global `composes` usage and separate static from interactive cards.
5. Migrate inline style clusters into component classes or scoped modules route by route.
6. Remove compatibility aliases only after all consumers migrate.

## 17. Phased implementation roadmap

### Phase 0 — Decisions and baselines

- Confirm the “civic calm” direction with representative Admin, Staff, Client, mobile, and kiosk screens.
- Confirm Google Maps API configuration, usage boundaries, and production key restrictions; replace incorrect OpenStreetMap/Leaflet wording in the interface and supporting documentation.
- Define metric names, role visibility, date/time zone, and thresholds.
- Capture baseline screenshots and performance/accessibility measurements.
- Freeze the route/role matrix and direct-access behavior.

**Exit:** approved visual direction, consistent Google Maps terminology/configuration requirements, data dictionary, and baseline evidence.

### Phase 1 — Foundations

- Semantic tokens, typography, focus, motion, responsive utilities
- Button, field, badge, alert, panel, skeleton, empty/error states
- Authenticated shell, role loading, sidebar groups, mobile drawer
- Shared page header and action layout

**Primary files:** `globals.css`, `public.css`, dashboard layout/sidebar/header, and new focused component files.

**Exit:** component states documented and shell usable by keyboard/mobile without changing page business behavior.

### Phase 2 — Role dashboards

- Build Admin command center first because it exercises all dashboard primitives.
- Add role-aware aggregate data contract and accessible chart wrappers.
- Build Staff work dashboard from verification/request queues.
- Build Client service dashboard with owner-scoped data.
- Add drill-down links and full state coverage.

**Exit:** each role sees unique, authorized, actionable content; charts have summaries and table alternatives.

### Phase 3 — Operational workspaces

Migrate Graves, Plots, Locations, Requests, Verification, Users, Feedback, Notifications, and Broadcasts to the shared resource/queue patterns. Start with the most frequently used page based on stakeholder evidence; if unavailable, start with Requests and Verification because their workflow states expose component gaps quickly.

**Exit:** forms, tables, filters, actions, dialogs, and statuses are consistent across operational routes.

### Phase 4 — Maps, public, kiosk, and authentication

Implement the responsive Google Maps workspace, then unify Home, Search, Kiosk, and Login with shared tokens/components. Validate kiosk privacy reset and map-independent directions.

**Exit:** one recognizable brand/system across public and authenticated experiences; all map UI and documentation consistently identify Google Maps API.

### Phase 5 — Analytics, reports, hardening, and cleanup

- Complete advanced analytics/drill-downs and separate them clearly from formal Reports.
- Remove obsolete style rules and remaining avoidable inline styles.
- Run accessibility, responsive, visual, performance, role, security, and production build gates.
- Update README/product documentation with the final component and dashboard conventions.

**Exit:** acceptance matrix passes and compatibility CSS is removed safely.

## 18. Validation matrix for implementation

| Area | Required checks |
|---|---|
| Visual consistency | Representative screenshots for every component state and role at compact, tablet, and desktop widths |
| Role behavior | Existing Admin/Staff/Client Playwright journeys plus direct-route denial and no wrong-role shell flash |
| Public | Search, no results, suggestions, error/retry, and mobile result actions |
| Kiosk | Touch layout, route generation, denied geolocation, timeout, inactivity/start-over privacy reset |
| Accessibility | Automated scan plus keyboard-only, screen-reader spot checks, contrast, zoom/reflow, and reduced motion |
| Dashboard data | Metric definitions, role scoping, date boundaries/time zone, zero values, partial data, and retry behavior |
| Charts | Text insight, data table, keyboard/tooltip behavior, resizing, no-data, and color-independent reading |
| Forms/dialogs | Labels, errors, focus trap/return, Escape, pending mutation, duplicate submit prevention |
| Tables | Header semantics, results count, filters, pagination, compact alternative, focus after mutation |
| Performance | Initial shell/content timing, layout shift, chart/map lazy loading, font delivery, bounded payloads |
| Regression | ESLint, targeted tests, existing Vitest, Next production build, and existing Playwright suites |

Do not weaken existing tests to accommodate the redesign. Update selectors toward roles, labels, and stable test IDs rather than styling classes.

## 19. Risks and required decisions

1. **Map terminology/configuration:** `docs/manuscript.md` is authoritative and specifies Google Maps API. The implementation already uses `@react-google-maps/api`; remove contradictory OpenStreetMap/Leaflet wording and verify production API-key restrictions, quotas, billing, and allowed origins before release.
2. **Data availability:** several proposed trends require trustworthy timestamped aggregates. Do not show fake graphs or compute global metrics from paginated client lists.
3. **Authorization drift:** role-aware dashboards can accidentally reveal aggregate data. Every field needs API-level authorization and an explicit visibility rule.
4. **Big-bang CSS risk:** replacing both global styles at once could break 37 routes. Use compatibility tokens and route-by-route migration.
5. **Dashboard overload:** more graphs do not automatically improve the product. Each visualization must answer a named role question and link to action/detail.
6. **Operational terminology:** status labels and thresholds need stakeholder approval so visual consistency does not change business meaning.
7. **Kiosk environment:** final dimensions, browser policy, input hardware, reset interval, and connectivity behavior need deployment confirmation.

## 20. Definition of done

The redesign is complete when:

- Admin, Staff, and Client dashboards are materially different, role-safe, and task-oriented.
- All routes use the same semantic tokens and core interaction components.
- Every button follows the defined hierarchy, dimensions, states, and accessible naming rules.
- No static panel falsely appears clickable; no clickable card lacks keyboard focus.
- Core data surfaces have loading, empty, error, retry, permission, and mutation states.
- Charts are accurate, useful, responsive, privacy-safe, and available as text/table content.
- Public, mobile, kiosk, and authenticated experiences feel like one product.
- Map implementation, interface copy, and supporting documentation consistently use Google Maps API.
- WCAG 2.2 AA acceptance checks and existing functional/role journeys pass.
- Production build, lint, relevant tests, and responsive browser suites pass without suppressing validation.
- Obsolete global rules and avoidable inline style duplication are removed after migration, not before.

## 21. Recommended first implementation slice

Begin with **Phase 0 plus the authenticated shell and Admin dashboard foundation**. This creates the highest-value visible improvement while establishing reusable tokens, buttons, cards, states, navigation, and chart wrappers. Implement only four Admin KPIs, one occupancy comparison chart, one request trend, and one prioritized queue initially. Validate the component model, role security, responsiveness, and accessibility before migrating the remaining pages. This avoids a risky full-project visual rewrite while still delivering the intended large-scale redesign through controlled, testable slices.
