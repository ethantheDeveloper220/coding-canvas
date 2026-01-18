import { Search, SortAsc, Filter, X, ChevronDown } from "lucide-react"
import { Button } from "../../../components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip"
import { Input } from "../../../components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import { cn } from "../../../lib/utils"
import { useState } from "react"

export type FileSortOption = "name" | "type" | "size" | "date"
export type FileChangeCategory = "all" | "added" | "modified" | "deleted"
export type CommitSearchScope = "workspace" | "all"

interface DiffSearchBarProps {
  /** Search query for file names */
  searchQuery: string
  /** Callback when search query changes */
  onSearchChange: (query: string) => void
  /** Current sort option */
  sortOption: FileSortOption
  /** Callback when sort option changes */
  onSortChange: (option: FileSortOption) => void
  /** Whether sort is ascending */
  sortAscending: boolean
  /** Callback when sort direction changes */
  onSortDirectionToggle: () => void
  /** Current file change category filter */
  categoryFilter: FileChangeCategory
  /** Callback when category filter changes */
  onCategoryFilterChange: (category: FileChangeCategory) => void
  /** Current commit search scope */
  commitScope: CommitSearchScope
  /** Callback when commit scope changes */
  onCommitScopeChange: (scope: CommitSearchScope) => void
  /** Whether there are active filters */
  hasActiveFilters: boolean
  /** Callback to clear all filters */
  onClearFilters: () => void
  /** Whether to show commit scope toggle (only in commit view) */
  showCommitScope?: boolean
  /** Whether to show category filter (only in diff view) */
  showCategoryFilter?: boolean
  /** Total files count */
  totalFiles: number
  /** Filtered files count */
  filteredFiles: number
}

const sortLabels: Record<FileSortOption, string> = {
  name: "File Name",
  type: "File Type",
  size: "Change Size",
  date: "Modified Date",
}

const categoryLabels: Record<FileChangeCategory, string> = {
  all: "All Changes",
  added: "Added Files",
  modified: "Modified Files",
  deleted: "Deleted Files",
}

const scopeLabels: Record<CommitSearchScope, string> = {
  workspace: "Workspace Only",
  all: "Entire Folder",
}

export const DiffSearchBar = ({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  sortAscending,
  onSortDirectionToggle,
  categoryFilter,
  onCategoryFilterChange,
  commitScope,
  onCommitScopeChange,
  hasActiveFilters,
  onClearFilters,
  showCommitScope = false,
  showCategoryFilter = true,
  totalFiles,
  filteredFiles,
}: DiffSearchBarProps) => {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b border-border">
      {/* Search input */}
      <div className="flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files by name or path..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs bg-background border-border"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-accent"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Sort dropdown */}
      <DropdownMenu open={isSortMenuOpen} onOpenChange={setIsSortMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              sortOption !== "name" && "text-foreground bg-accent/50"
            )}
          >
            <SortAsc className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{sortLabels[sortOption]}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isSortMenuOpen && "rotate-180"
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(sortLabels).map(([option, label]) => (
            <DropdownMenuItem
              key={option}
              onClick={() => {
                if (sortOption === option) {
                  onSortDirectionToggle()
                } else {
                  onSortChange(option as FileSortOption)
                }
                setIsSortMenuOpen(false)
              }}
              className="flex items-center justify-between"
            >
              <span>{label}</span>
              {sortOption === option && (
                <span className="text-muted-foreground text-xs">
                  {sortAscending ? "↑" : "↓"}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Category/Scope filter dropdown */}
      <DropdownMenu open={isFilterMenuOpen} onOpenChange={setIsFilterMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              (showCommitScope && commitScope === "all") ||
              (showCategoryFilter && categoryFilter !== "all")
                ? "text-foreground bg-accent/50"
                : ""
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {showCommitScope
                ? scopeLabels[commitScope]
                : categoryLabels[categoryFilter]}
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isFilterMenuOpen && "rotate-180"
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Filter by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {showCommitScope && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Search Scope
              </DropdownMenuLabel>
              {Object.entries(scopeLabels).map(([option, label]) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => {
                    onCommitScopeChange(option as CommitSearchScope)
                    setIsFilterMenuOpen(false)
                  }}
                  className={cn(
                    commitScope === option && "bg-accent/50"
                  )}
                >
                  {label}
                </DropdownMenuItem>
              ))}
              {showCategoryFilter && <DropdownMenuSeparator />}
            </>
          )}
          {showCategoryFilter && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Change Type
              </DropdownMenuLabel>
              {Object.entries(categoryLabels).map(([option, label]) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => {
                    onCategoryFilterChange(option as FileChangeCategory)
                    setIsFilterMenuOpen(false)
                  }}
                  className={cn(
                    categoryFilter === option && "bg-accent/50"
                  )}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={onClearFilters}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all filters</TooltipContent>
        </Tooltip>
      )}

      {/* File count */}
      <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
        {filteredFiles === totalFiles ? (
          <span>{totalFiles} file{totalFiles !== 1 ? "s" : ""}</span>
        ) : (
          <span>
            {filteredFiles} of {totalFiles} file
            {totalFiles !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}
