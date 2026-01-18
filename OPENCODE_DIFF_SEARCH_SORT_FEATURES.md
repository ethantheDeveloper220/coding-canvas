# OpenCode Diff Search & Sort Features

This document describes the new search and sort functionality added to the OpenCode diff integration.

## Overview

New search, sort, and filter capabilities have been added to:
1. **Session Review** - The main diff viewer showing file changes
2. **Commit History** - View and search through git commits
3. **Agent Diff View** - Enhanced diff viewer for 1Code desktop app

## Features Implemented

### 1. Session Review (`opencode/packages/ui/src/components/`)

#### Files Added/Modified:
- **session-review.tsx** - Updated with search/sort state and logic
- **session-review-search.tsx** - New search bar component
- **session-review-search.css** - Styles for search bar

#### Features:
✅ **File Search**
- Search files by name or path
- Real-time filtering as you type
- Clear search button

✅ **Sort Options**
- Sort by: Name, Type, Size
- Toggle ascending/descending order
- Visual indicator for current sort

✅ **Category Filters**
- All changes
- Added files only
- Modified files only
- Deleted files only

✅ **UI Elements**
- Search input with icon
- Sort dropdown menu
- Filter dropdown menu
- Clear all filters button
- File count display (filtered / total)

### 2. Commit History (`opencode/packages/ui/src/components/`)

#### Files Added:
- **commit-history.tsx** - New commit history viewer
- **commit-history.css** - Styles for commit list

#### Features:
✅ **Commit Search**
- Search by commit message
- Search by author
- Search by commit hash
- Search by affected files

✅ **Search Scope**
- Workspace only (current changes)
- Entire folder (all commits)
- Toggle between scopes

✅ **Sort Options**
- Sort by Date
- Sort by Author
- Toggle ascending/descending

✅ **Commit Display**
- Commit hash
- Author and date
- Commit message
- File count
- Additions/deletions stats
- File preview (shows up to 3 files)

✅ **UI Elements**
- Empty state when no commits found
- Active state indicator for selected commit
- Hover and active states for better UX

### 3. Agent Diff View (`src/renderer/features/agents/ui/`)

#### Files Modified:
- **agent-diff-view.tsx** - Added search/sort state and logic
- **diff-search-bar.tsx** - New search bar component (React)

#### Features:
All same features as Session Review but implemented in React for the 1Code desktop app.

## Component Usage

### Session Review

The search bar automatically appears when there are file changes to display:

```tsx
<SessionReview
  diffs={fileDiffs}
  diffStyle="unified"
  onDiffStyleChange={handleStyleChange}
/>
```

No additional props needed - search/sort is built-in!

### Commit History

```tsx
<CommitHistory
  commits={commits}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  scope="workspace"
  onScopeChange={setScope}
  sortOption="date"
  onSortChange={setSortOption}
  sortAscending={true}
  onSortDirectionToggle={toggleDirection}
  onCommitSelect={handleCommitSelect}
  selectedCommit={selectedHash}
/>
```

## Styling

### CSS Variables Used
The components use these CSS variables (should be available in your theme):
- `--background-stronger` - Header background
- `--surface-base` / `--surface-default` - Card backgrounds
- `--border-default` / `--border-hover` / `--border-focus` - Borders
- `--text-strong` / `--text-base` / `--text-muted` - Text colors
- `--primary-bg` / `--primary-default` / `--primary-text` - Primary colors
- `--success-text` / `--danger-text` - Stats colors
- `--shadow-lg` - Dropdown shadows

### Responsive Design
- Search bar adjusts to available space
- Dropdowns align correctly on different screen sizes
- Mobile-friendly touch targets

## Performance

- ✅ Real-time filtering using SolidJS reactive computations
- ✅ Efficient sorting algorithms
- ✅ Virtual scrolling support (in agent diff view)
- ✅ Debounced search not needed (fast enough for typical file counts)

## Accessibility

- ✅ Keyboard navigation support
- ✅ Clear visual focus states
- ✅ ARIA labels on buttons
- ✅ Semantic HTML structure
- ✅ High contrast colors for text

## Browser Compatibility

Works in all modern browsers that support:
- CSS Grid and Flexbox
- CSS Custom Properties
- ES6+ JavaScript

## Future Enhancements

Potential additions:
1. Advanced search with regex support
2. Date range filtering for commits
3. Multi-select filters
4. Save/load filter presets
5. Search history
6. Keyboard shortcuts for common actions

## Testing

To test the features:
1. Start a session with file changes
2. Open the Review tab
3. Try searching for specific files
4. Sort by different criteria
5. Filter by change type
6. Clear filters and verify reset

## Files Changed

### New Files
- `opencode/packages/ui/src/components/session-review-search.tsx`
- `opencode/packages/ui/src/components/session-review-search.css`
- `opencode/packages/ui/src/components/commit-history.tsx`
- `opencode/packages/ui/src/components/commit-history.css`
- `src/renderer/features/agents/ui/diff-search-bar.tsx`

### Modified Files
- `opencode/packages/ui/src/components/session-review.tsx`
- `src/renderer/features/agents/ui/agent-diff-view.tsx`

## Migration Notes

No breaking changes - the features are opt-in and don't affect existing functionality.

SessionReview component maintains backward compatibility - all existing props work as before, with new search/sort features automatically enabled.
