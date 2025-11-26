import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TenderCard } from "@/components/TenderCard";
import { FiltersPanel, getDefaultFilters, type FiltersState } from "@/components/FiltersPanel";
import { TenderDetailModal } from "@/components/TenderDetailModal";
import { UploadModal } from "@/components/UploadModal";
import { AssignTenderDialog } from "@/components/AssignTenderDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  Upload, 
  FileStack, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Filter,
  X,
  Trash2,
  Loader2,
  Smartphone,
  Globe,
  HardDrive,
  Users,
  Layers,
  Code
} from "lucide-react";
import type { Tender } from "@shared/schema";

const projectTypeFilters = [
  { value: "all", label: "All", icon: Layers },
  { value: "software", label: "Software", icon: Code },
  { value: "mobile", label: "Mobile", icon: Smartphone },
  { value: "website", label: "Website", icon: Globe },
  { value: "hardware", label: "Hardware", icon: HardDrive },
  { value: "manpower", label: "Manpower", icon: Users },
];

interface DashboardStats {
  total: number;
  fullMatch: number;
  pendingAnalysis: number;
  notEligible: number;
  todayUploads: number;
}

export default function Dashboard() {
  const [filters, setFilters] = useState<FiltersState>(getDefaultFilters());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [tenderToAssign, setTenderToAssign] = useState<Tender | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: tenders = [], isLoading: tendersLoading } = useQuery<Tender[]>({
    queryKey: ["/api/tenders"],
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/data/all");
    },
    onSuccess: () => {
      toast({
        title: "Data Deleted",
        description: "All tender data has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTenders = useMemo(() => {
    return tenders.filter((tender) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          tender.t247Id.toLowerCase().includes(query) ||
          tender.title?.toLowerCase().includes(query) ||
          tender.department?.toLowerCase().includes(query) ||
          tender.organization?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Project type filter based on title/eligibility keywords
      if (projectTypeFilter !== "all") {
        const searchText = `${tender.title || ''} ${tender.eligibilityCriteria || ''}`.toLowerCase();
        const tenderTags: string[] = tender.tags || [];
        
        switch (projectTypeFilter) {
          case "software":
            if (!searchText.includes("software") && !searchText.includes("application") && 
                !searchText.includes("development") && !searchText.includes("it project") &&
                !tenderTags.some((tag: string) => tag.toLowerCase().includes("software"))) {
              return false;
            }
            break;
          case "mobile":
            if (!searchText.includes("mobile") && !searchText.includes("app") && 
                !tenderTags.some((tag: string) => tag.toLowerCase().includes("mobile"))) {
              return false;
            }
            break;
          case "website":
            if (!searchText.includes("website") && !searchText.includes("web") && 
                !searchText.includes("portal") &&
                !tenderTags.some((tag: string) => tag.toLowerCase().includes("website"))) {
              return false;
            }
            break;
          case "hardware":
            if (!searchText.includes("hardware") && !searchText.includes("equipment") && 
                !searchText.includes("server") && !searchText.includes("computer") &&
                !tenderTags.some((tag: string) => tag.toLowerCase().includes("hardware"))) {
              return false;
            }
            break;
          case "manpower":
            if (!searchText.includes("manpower") && !searchText.includes("resource") && 
                !searchText.includes("personnel") && !searchText.includes("staff") &&
                !searchText.includes("deployment") &&
                !tenderTags.some((tag: string) => tag.toLowerCase().includes("manpower"))) {
              return false;
            }
            break;
        }
      }

      if (filters.matchRange[0] > 0 || filters.matchRange[1] < 100) {
        const matchPct = tender.matchPercentage ?? 0;
        if (matchPct < filters.matchRange[0] || matchPct > filters.matchRange[1]) {
          return false;
        }
      }

      if (filters.tenderTypes.length > 0) {
        if (!filters.tenderTypes.includes(tender.tenderType)) {
          return false;
        }
      }

      if (filters.tags.length > 0) {
        const tenderTags = tender.tags || [];
        if (!filters.tags.some(tag => tenderTags.includes(tag))) {
          return false;
        }
      }

      if (filters.analysisStatus.length > 0) {
        if (!filters.analysisStatus.includes(tender.analysisStatus || 'analyzed')) {
          return false;
        }
      }

      if (filters.showCorrigendum && !tender.isCorrigendum) {
        return false;
      }

      if (filters.dateFrom || filters.dateTo) {
        const deadline = tender.submissionDeadline ? new Date(tender.submissionDeadline) : null;
        if (deadline) {
          if (filters.dateFrom && deadline < new Date(filters.dateFrom)) return false;
          if (filters.dateTo && deadline > new Date(filters.dateTo)) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      return (b.matchPercentage || 0) - (a.matchPercentage || 0);
    });
  }, [tenders, filters, searchQuery, projectTypeFilter]);

  const statCards = [
    {
      title: "Total Tenders",
      value: stats?.total || 0,
      icon: FileStack,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "100% Match",
      value: stats?.fullMatch || 0,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Not Eligible",
      value: stats?.notEligible || 0,
      icon: X,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Pending Analysis",
      value: stats?.pendingAnalysis || 0,
      icon: AlertCircle,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Today's Uploads",
      value: stats?.todayUploads || 0,
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border bg-background">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              View and filter your analyzed tenders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive"
                  disabled={deleteAllMutation.isPending || (stats?.total || 0) === 0}
                  data-testid="button-delete-all"
                >
                  {deleteAllMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {stats?.total || 0} tenders and upload history. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button 
              onClick={() => setShowUploadModal(true)}
              data-testid="button-upload-excel"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    {statsLoading ? (
                      <Skeleton className="h-6 w-12 mt-1" />
                    ) : (
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showFilters && (
          <div className="w-72 border-r border-border p-4 overflow-y-auto hidden lg:block">
            <FiltersPanel 
              filters={filters} 
              onFiltersChange={setFilters}
              onClearFilters={() => setFilters(getDefaultFilters())}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-background">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, title, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-tenders"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden"
                data-testid="button-toggle-filters"
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground mr-2">Project Type:</span>
              {projectTypeFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = projectTypeFilter === filter.value;
                return (
                  <Button
                    key={filter.value}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProjectTypeFilter(filter.value)}
                    className="gap-1.5"
                    data-testid={`filter-project-${filter.value}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {filter.label}
                  </Button>
                );
              })}
            </div>
            
            <div className="mt-2 text-sm text-muted-foreground">
              Showing {filteredTenders.length} of {tenders.length} tenders
              {projectTypeFilter !== "all" && (
                <span className="ml-1">
                  (filtered by {projectTypeFilters.find(f => f.value === projectTypeFilter)?.label})
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {tendersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-full mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTenders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileStack className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">No tenders found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {tenders.length === 0 
                    ? "Upload an Excel file to get started" 
                    : "Try adjusting your filters or search query"}
                </p>
                {tenders.length === 0 && (
                  <Button onClick={() => setShowUploadModal(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Excel
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTenders.map((tender) => (
                  <TenderCard
                    key={tender.id}
                    tender={tender}
                    onClick={() => setSelectedTender(tender)}
                    showAssignButton={tender.eligibilityStatus === 'eligible'}
                    onAssign={() => setTenderToAssign(tender)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TenderDetailModal
        tender={selectedTender}
        open={!!selectedTender}
        onClose={() => setSelectedTender(null)}
      />

      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      <AssignTenderDialog
        tender={tenderToAssign}
        open={!!tenderToAssign}
        onClose={() => setTenderToAssign(null)}
      />
    </div>
  );
}
