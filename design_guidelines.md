# Tender Management System - Design Guidelines

## Design Approach

**Selected Approach**: Design System (Utility-Focused Dashboard)
- Primary Inspiration: Linear (modern data tools), Notion (information architecture), Asana (task management)
- Rationale: Enterprise productivity tool requiring efficiency, clarity, and data-heavy interfaces
- Principle: Function over form - every element serves the core purpose of rapid tender filtering and analysis

## Typography

**Font System**: Inter (via Google Fonts CDN)
- Headings: Semi-bold (600), sizes: text-2xl (dashboard), text-xl (sections), text-lg (cards)
- Body Text: Regular (400), text-base for content, text-sm for metadata
- Data/Numbers: Mono variant for T247 IDs, budgets, dates (font-mono)
- Labels: Medium (500), text-xs uppercase for tags and filters

## Layout System

**Spacing Primitives**: Tailwind units 2, 4, 6, 8, 12
- Component padding: p-4 to p-8
- Section gaps: gap-6 for grids, gap-4 for lists
- Card spacing: p-6 for content cards, p-4 for compact items

**Grid Structure**:
- Main dashboard: Sidebar (w-64) + Content area (flex-1)
- Tender cards: grid-cols-1 lg:grid-cols-2 xl:grid-cols-3
- Comparison view: grid-cols-2 (side-by-side)
- Filters sidebar: w-72 fixed height with scroll

## Component Library

**Navigation**
- Top bar: Logo left, admin settings/logout right, h-16, border-b
- Sidebar: Fixed left, icons + labels, active state with left border accent
- Menu items: Upload Excel, Dashboard, Corrigendum, Unable to Analyse, Settings

**Dashboard Cards**
- Tender cards with rounded corners (rounded-lg), shadow-sm, hover:shadow-md
- Header: T247 ID (font-mono) + Match percentage badge (top-right)
- Body: Tender title (font-semibold), Turnover, Budget, EMD (grid layout)
- Tags row: Pill badges for Manpower, IT, Software, Website, Mobile
- Footer: Date posted + Gem/Non-Gem indicator

**Match Percentage System**
- 100%: Solid badge with checkmark icon, positioned top-right
- 75-99%: Medium opacity badge
- 50-74%: Lower opacity badge
- <50%: Minimal opacity badge
- "MSME Exempted" special badge with star icon

**Filters Panel**
- Collapsible sections with chevron icons
- Checkbox groups: Match ranges, Gem/Non-Gem, Tags
- Range sliders: Budget, EMD with min/max inputs
- Date range picker: From/To inputs
- Clear filters button at bottom

**Data Tables** (for Excel history view)
- Fixed header row, striped rows for readability
- Sortable columns with arrow indicators
- Action buttons: View, Download, Compare (icon buttons)
- Pagination at bottom (showing "1-50 of 234 tenders")

**Comparison View** (Corrigendum)
- Split screen 50/50
- Headers: "Original" vs "Updated" with dates
- Changed fields highlighted with yellow background
- Field-by-field layout with labels on left
- Diff indicators: Added (green accent), Removed (red accent), Modified (yellow accent)

**Upload Interface**
- Drag-and-drop zone (dashed border, large area, min-h-64)
- File input fallback button
- Progress bar during upload
- File preview with sheet names (Gem/Non-Gem) before processing

**Admin Settings Panel**
- Form layout with clear sections
- Company criteria inputs: Turnover (number input with "CR" suffix)
- Project types: Checkboxes with labels (Software, Website, Mobile, IT, Manpower)
- Save button (prominent, right-aligned)

**Unable to Analyse Section**
- Tender cards with "Upload PDF" button overlay
- PDF drag-and-drop modal for individual tenders
- Processing indicator after upload

**Status Indicators**
- Processing: Animated spinner
- Success: Green checkmark
- Error: Red X with error message
- Warning: Yellow triangle for attention needed

## Images

No hero images needed - this is a functional dashboard application. Use icons from Heroicons (via CDN) for:
- Navigation icons (Dashboard, Upload, Settings)
- Action buttons (Download, Compare, Delete)
- Status indicators (Checkmark, Warning, Info)
- Tag icons (Code for Software, Users for Manpower, Globe for Website)

## Interaction Patterns

**Hover States**
- Cards: Subtle elevation increase (shadow-md to shadow-lg)
- Buttons: Slight opacity change
- Table rows: Background tint

**Active/Focus States**
- Input fields: Border accent
- Selected filters: Background fill
- Active nav items: Left border + background tint

**Loading States**
- Skeleton loaders for tender cards (pulsing gray blocks)
- Spinner for data processing
- Progress bars for file uploads

## Layout Specifications

**Login Page**: Centered card (max-w-md), simple form, company logo at top

**Dashboard Layout**: 
- Sidebar navigation (fixed left)
- Top stats bar: Total tenders, 100% matches, Pending analysis, Today's uploads
- Filter panel (collapsible right sidebar on desktop, drawer on mobile)
- Main content: Grid of tender cards with infinite scroll

**Detail View**: Modal overlay with close X, full tender data in organized sections, action buttons at bottom

**Responsive Behavior**: 
- Desktop (lg:): Sidebar visible, 3-column grid
- Tablet (md:): Hamburger menu, 2-column grid  
- Mobile: Full-width cards, bottom sheet filters