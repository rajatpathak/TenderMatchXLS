import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TenderCard } from "@/components/TenderCard";
import { FiltersPanel, getDefaultFilters, type FiltersState } from "@/components/FiltersPanel";
import { TenderDetailModal } from "@/components/TenderDetailModal";
import { UploadModal } from "@/components/UploadModal";
import { 
  Search, 
  Upload, 
  FileStack, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Filter,
  X
} from "lucide-react";
import type { Tender } from "@shared/schema";

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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: tenders = [], isLoading: tendersLoading } = useQuery<Tender[]>({
    queryKey: ["/api/tenders"],
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

      if (filters.matchRange[0] > 0 || filters.matchRange[1] < 100) {
        if (tender.matchPercentage < filters.matchRange[0] || 
            tender.matchPercentage > filters.matchRange[1]) {
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
  }, [tenders, filters, searchQuery]);

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
          <Button 
            onClick={() => setShowUploadModal(true)}
            data-testid="button-upload-excel"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Excel
          </Button>
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
            <div className="mt-2 text-sm text-muted-foreground">
              Showing {filteredTenders.length} of {tenders.length} tenders
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
    </div>
  );
}
