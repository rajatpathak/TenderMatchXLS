import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ChevronDown, X, Filter, Calendar } from "lucide-react";

export interface FiltersState {
  matchRange: [number, number];
  tenderTypes: string[];
  tags: string[];
  budgetRange: [number, number];
  emdRange: [number, number];
  dateFrom: string;
  dateTo: string;
  analysisStatus: string[];
  showCorrigendum: boolean;
}

interface FiltersPanelProps {
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  onClearFilters: () => void;
}

const availableTags = ['Manpower', 'IT Projects', 'Software', 'Website', 'Mobile'];
const tenderTypes = ['gem', 'non_gem'];
const analysisStatuses = ['analyzed', 'not_eligible', 'unable_to_analyze'];

export function FiltersPanel({ filters, onFiltersChange, onClearFilters }: FiltersPanelProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    match: true,
    type: true,
    tags: false,
    budget: false,
    date: false,
    status: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayItem = (key: 'tenderTypes' | 'tags' | 'analysisStatus', item: string) => {
    const current = filters[key];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    updateFilter(key, updated);
  };

  const hasActiveFilters = 
    filters.matchRange[0] > 0 || 
    filters.matchRange[1] < 100 ||
    filters.tenderTypes.length > 0 ||
    filters.tags.length > 0 ||
    filters.budgetRange[0] > 0 ||
    filters.budgetRange[1] < 100 ||
    filters.emdRange[0] > 0 ||
    filters.emdRange[1] < 100 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.analysisStatus.length > 0 ||
    filters.showCorrigendum;

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="h-7 text-xs"
              data-testid="button-clear-filters"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <Collapsible open={openSections.match}>
          <CollapsibleTrigger 
            className="flex items-center justify-between w-full py-2 text-sm font-medium hover-elevate rounded-md px-2 -mx-2"
            onClick={() => toggleSection('match')}
            data-testid="trigger-match-filter"
          >
            <span>Match Percentage</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.match ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            <div className="px-1">
              <Slider
                value={[filters.matchRange[0], filters.matchRange[1]]}
                onValueChange={(value) => updateFilter('matchRange', [value[0], value[1]])}
                min={0}
                max={100}
                step={5}
                className="my-4"
                data-testid="slider-match-range"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filters.matchRange[0]}%</span>
                <span>{filters.matchRange[1]}%</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={openSections.type}>
          <CollapsibleTrigger 
            className="flex items-center justify-between w-full py-2 text-sm font-medium hover-elevate rounded-md px-2 -mx-2"
            onClick={() => toggleSection('type')}
            data-testid="trigger-type-filter"
          >
            <span>Tender Type</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.type ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {tenderTypes.map((type) => (
              <label 
                key={type} 
                className="flex items-center gap-2 cursor-pointer text-sm hover-elevate rounded-md py-1 px-2 -mx-2"
              >
                <Checkbox
                  checked={filters.tenderTypes.includes(type)}
                  onCheckedChange={() => toggleArrayItem('tenderTypes', type)}
                  data-testid={`checkbox-type-${type}`}
                />
                <span className="capitalize">{type === 'gem' ? 'GEM' : 'Non-GEM'}</span>
              </label>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={openSections.tags}>
          <CollapsibleTrigger 
            className="flex items-center justify-between w-full py-2 text-sm font-medium hover-elevate rounded-md px-2 -mx-2"
            onClick={() => toggleSection('tags')}
            data-testid="trigger-tags-filter"
          >
            <span>Tags</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.tags ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {availableTags.map((tag) => (
              <label 
                key={tag} 
                className="flex items-center gap-2 cursor-pointer text-sm hover-elevate rounded-md py-1 px-2 -mx-2"
              >
                <Checkbox
                  checked={filters.tags.includes(tag)}
                  onCheckedChange={() => toggleArrayItem('tags', tag)}
                  data-testid={`checkbox-tag-${tag}`}
                />
                <span>{tag}</span>
              </label>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={openSections.budget}>
          <CollapsibleTrigger 
            className="flex items-center justify-between w-full py-2 text-sm font-medium hover-elevate rounded-md px-2 -mx-2"
            onClick={() => toggleSection('budget')}
            data-testid="trigger-budget-filter"
          >
            <span>Budget Range</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.budget ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min (Lakhs)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.budgetRange[0]}
                  onChange={(e) => updateFilter('budgetRange', [Number(e.target.value), filters.budgetRange[1]])}
                  className="h-8 text-sm"
                  data-testid="input-budget-min"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max (Lakhs)</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={filters.budgetRange[1]}
                  onChange={(e) => updateFilter('budgetRange', [filters.budgetRange[0], Number(e.target.value)])}
                  className="h-8 text-sm"
                  data-testid="input-budget-max"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={openSections.date}>
          <CollapsibleTrigger 
            className="flex items-center justify-between w-full py-2 text-sm font-medium hover-elevate rounded-md px-2 -mx-2"
            onClick={() => toggleSection('date')}
            data-testid="trigger-date-filter"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Deadline
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.date ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-date-from"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-date-to"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={openSections.status}>
          <CollapsibleTrigger 
            className="flex items-center justify-between w-full py-2 text-sm font-medium hover-elevate rounded-md px-2 -mx-2"
            onClick={() => toggleSection('status')}
            data-testid="trigger-status-filter"
          >
            <span>Analysis Status</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.status ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {analysisStatuses.map((status) => (
              <label 
                key={status} 
                className="flex items-center gap-2 cursor-pointer text-sm hover-elevate rounded-md py-1 px-2 -mx-2"
              >
                <Checkbox
                  checked={filters.analysisStatus.includes(status)}
                  onCheckedChange={() => toggleArrayItem('analysisStatus', status)}
                  data-testid={`checkbox-status-${status}`}
                />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </label>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <div className="pt-2 border-t border-border">
          <label className="flex items-center gap-2 cursor-pointer text-sm hover-elevate rounded-md py-1 px-2 -mx-2">
            <Checkbox
              checked={filters.showCorrigendum}
              onCheckedChange={(checked) => updateFilter('showCorrigendum', checked as boolean)}
              data-testid="checkbox-show-corrigendum"
            />
            <span>Show Corrigendums Only</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

export function getDefaultFilters(): FiltersState {
  return {
    matchRange: [0, 100],
    tenderTypes: [],
    tags: [],
    budgetRange: [0, 100],
    emdRange: [0, 100],
    dateFrom: '',
    dateTo: '',
    analysisStatus: [],
    showCorrigendum: false,
  };
}
