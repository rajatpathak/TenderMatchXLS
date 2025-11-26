import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TenderCard } from "@/components/TenderCard";
import { TenderDetailModal } from "@/components/TenderDetailModal";
import { 
  Search, 
  CheckCircle,
  XCircle,
  Ban,
  FileSearch,
} from "lucide-react";
import type { Tender } from "@shared/schema";

interface TenderCategoryPageProps {
  status: "eligible" | "not_eligible" | "not_relevant" | "manual_review";
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
};

export default function TenderCategoryPage({ status, title, description }: TenderCategoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);

  const { data: tenders = [], isLoading } = useQuery<Tender[]>({
    queryKey: ["/api/tenders/status", status],
  });

  const filteredTenders = useMemo(() => {
    if (!searchQuery) return tenders;
    
    const query = searchQuery.toLowerCase();
    return tenders.filter((tender) => {
      return (
        tender.t247Id.toLowerCase().includes(query) ||
        tender.title?.toLowerCase().includes(query) ||
        tender.department?.toLowerCase().includes(query) ||
        tender.organization?.toLowerCase().includes(query)
      );
    });
  }, [tenders, searchQuery]);

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
          
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-4">
              Showing {filteredTenders.length} of {tenders.length} tenders
            </div>
            
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-48" />
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTenders.map((tender) => (
                  <TenderCard
                    key={tender.id}
                    tender={tender}
                    onClick={() => setSelectedTender(tender)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TenderDetailModal
        tender={selectedTender}
        open={selectedTender !== null}
        onClose={() => setSelectedTender(null)}
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
