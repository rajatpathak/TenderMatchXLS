import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TenderCard, TenderCardSkeleton } from "@/components/TenderCard";
import { TenderDetailModal } from "@/components/TenderDetailModal";
import { AssignTenderDialog } from "@/components/AssignTenderDialog";
import { useAuth } from "@/hooks/useAuth";
import { 
  Search, 
  CheckCircle,
  XCircle,
  Ban,
  FileSearch,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Calendar,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tender, TenderAssignment, TeamMember } from "@shared/schema";

interface TenderCategoryPageProps {
  status: "eligible" | "not_eligible" | "not_relevant" | "manual_review" | "missed";
  title: string;
  description: string;
}

const categoryConfig = {
  eligible: {
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  not_eligible: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10",
  },
  not_relevant: {
    icon: Ban,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-500/10",
  },
  manual_review: {
    icon: FileSearch,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  missed: {
    icon: Clock,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-500/10",
  },
};

const ITEMS_PER_PAGE = 30;

export default function TenderCategoryPage({ status, title, description }: TenderCategoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [tenderToAssign, setTenderToAssign] = useState<Tender | null>(null);
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");

  const { user } = useAuth();

  const { data: tenders = [], isLoading, isFetching } = useQuery<Tender[]>({
    queryKey: ["/api/tenders/status", status],
    staleTime: 30000,
  });

  const { data: locations = [] } = useQuery<string[]>({
    queryKey: ["/api/tenders/locations"],
  });

  const { data: currentTeamMember } = useQuery<Omit<TeamMember, "password">>({
    queryKey: ["/api/me/team-member"],
    retry: false,
  });

  const { data: assignments = [] } = useQuery<TenderAssignment[]>({
    queryKey: ["/api/assignments"],
    enabled: status === "eligible",
  });

  const assignedTenderIds = useMemo(() => {
    return new Set(assignments.map(a => a.tenderId));
  }, [assignments]);

  const canAssign = currentTeamMember?.role === "admin" || currentTeamMember?.role === "manager";
  const isBidder = currentTeamMember?.role === "bidder";

  const handleAssignTender = (tender: Tender) => {
    setTenderToAssign(tender);
    setAssignDialogOpen(true);
  };

  const filteredTenders = useMemo(() => {
    return tenders.filter((tender) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!(tender.t247Id.toLowerCase().includes(query) ||
          tender.title?.toLowerCase().includes(query) ||
          tender.department?.toLowerCase().includes(query) ||
          tender.organization?.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Location filter
      if (selectedLocation !== "all" && tender.location !== selectedLocation) {
        return false;
      }

      // Submission deadline filter
      if (deadlineFrom) {
        const fromDate = new Date(deadlineFrom);
        const tenderDeadline = tender.submissionDeadline ? new Date(tender.submissionDeadline) : null;
        if (!tenderDeadline || tenderDeadline < fromDate) {
          return false;
        }
      }

      if (deadlineTo) {
        const toDate = new Date(deadlineTo);
        const tenderDeadline = tender.submissionDeadline ? new Date(tender.submissionDeadline) : null;
        if (!tenderDeadline || tenderDeadline > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [tenders, searchQuery, selectedLocation, deadlineFrom, deadlineTo]);

  const totalPages = Math.ceil(filteredTenders.length / ITEMS_PER_PAGE);
  
  const paginatedTenders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTenders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTenders, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const config = categoryConfig[status];
  const Icon = config.icon;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, title, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[300px]"
                data-testid="input-search"
              />
            </div>
            
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-40" data-testid="filter-location">
                <MapPin className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <label htmlFor="deadline-from" className="sr-only">Deadline from</label>
              <input
                id="deadline-from"
                name="deadline-from"
                type="date"
                value={deadlineFrom}
                onChange={(e) => setDeadlineFrom(e.target.value)}
                className="px-2 py-1 border border-border rounded text-sm"
                data-testid="filter-deadline-from"
              />
              <span className="text-xs text-muted-foreground px-1">to</span>
              <label htmlFor="deadline-to" className="sr-only">Deadline to</label>
              <input
                id="deadline-to"
                name="deadline-to"
                type="date"
                value={deadlineTo}
                onChange={(e) => setDeadlineTo(e.target.value)}
                className="px-2 py-1 border border-border rounded text-sm"
                data-testid="filter-deadline-to"
              />
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  "Loading tenders..."
                ) : (
                  <>
                    Showing {paginatedTenders.length} of {filteredTenders.length} tenders
                    {filteredTenders.length !== tenders.length && ` (filtered from ${tenders.length})`}
                  </>
                )}
              </div>
              {isFetching && !isLoading && (
                <div className="text-xs text-muted-foreground animate-pulse">
                  Refreshing...
                </div>
              )}
            </div>
            
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <TenderCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredTenders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No tenders found</p>
                <p className="text-sm">
                  {searchQuery 
                    ? "Try adjusting your search query" 
                    : `No tenders in the "${title}" category`}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {paginatedTenders.map((tender) => (
                    <TenderCard
                      key={tender.id}
                      tender={tender}
                      onClick={() => setSelectedTender(tender)}
                      onAssign={handleAssignTender}
                      isAssigned={assignedTenderIds.has(tender.id)}
                    />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-9"
                            onClick={() => handlePageChange(pageNum)}
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    
                    <span className="text-sm text-muted-foreground ml-2">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <TenderDetailModal
        tender={selectedTender}
        open={selectedTender !== null}
        onClose={() => setSelectedTender(null)}
      />

      <AssignTenderDialog
        tender={tenderToAssign}
        open={assignDialogOpen}
        onClose={() => {
          setAssignDialogOpen(false);
          setTenderToAssign(null);
        }}
        selfAssign={isBidder}
      />
    </div>
  );
}

export function EligibleTendersPage() {
  return (
    <TenderCategoryPage
      status="eligible"
      title="Eligible Tenders"
      description="Tenders that match your company criteria"
    />
  );
}

export function NotRelevantTendersPage() {
  return (
    <TenderCategoryPage
      status="not_relevant"
      title="Not Relevant"
      description="Tenders filtered by negative keywords"
    />
  );
}

export function NotEligibleTendersPage() {
  return (
    <TenderCategoryPage
      status="not_eligible"
      title="Not Eligible"
      description="Tenders where company doesn't meet requirements"
    />
  );
}

export function ManualReviewTendersPage() {
  return (
    <TenderCategoryPage
      status="manual_review"
      title="Manual Review"
      description="Tenders requiring PDF upload for eligibility analysis"
    />
  );
}

export function MissedTendersPage() {
  return (
    <TenderCategoryPage
      status="missed"
      title="Missed Tenders"
      description="Tenders with deadlines that have passed"
    />
  );
}
