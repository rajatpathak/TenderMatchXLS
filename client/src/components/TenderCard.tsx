import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  IndianRupee, 
  Building2, 
  Star,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle2,
  Users,
  Code,
  Globe,
  Smartphone,
  Monitor,
  TrendingUp,
  Ban,
  XCircle,
  FileSearch,
  PenLine,
  ThumbsDown
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tender } from "@shared/schema";

export function TenderCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-full max-w-[280px]" />
            <Skeleton className="h-5 w-3/4 mt-1" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-12 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

interface TenderCardProps {
  tender: Tender;
  onClick: () => void;
  showQuickActions?: boolean;
}

const tagIcons: Record<string, React.ElementType> = {
  'Manpower': Users,
  'IT': Monitor,
  'Software': Code,
  'Website': Globe,
  'Mobile': Smartphone,
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  'eligible': {
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    label: "Eligible"
  },
  'not_eligible': {
    icon: XCircle,
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    label: "Not Eligible"
  },
  'not_relevant': {
    icon: Ban,
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800",
    label: "Not Relevant"
  },
  'manual_review': {
    icon: FileSearch,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    label: "Manual Review"
  },
};

const defaultStatusInfo = {
  icon: CheckCircle2,
  color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  label: "Unknown"
};

export function TenderCard({ tender, onClick, showQuickActions = true }: TenderCardProps) {
  const { toast } = useToast();
  const matchPct = tender.matchPercentage ?? 0;

  // Quick override mutation
  const overrideMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason: string }) => {
      return apiRequest("POST", `/api/tenders/${tender.id}/override`, {
        overrideStatus: status,
        overrideReason: reason,
        overrideComment: `Quick action: marked as ${status === 'not_eligible' ? 'Not Eligible' : 'Not Relevant'}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Status Updated",
        description: "Tender status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update tender status.",
        variant: "destructive",
      });
    },
  });
  
  const getMatchColor = () => {
    if (tender.isMsmeExempted || tender.isStartupExempted) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800";
    }
    if (matchPct >= 100) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    }
    if (matchPct >= 75) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    }
    if (matchPct >= 50) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    }
    if (matchPct >= 25) {
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    }
    return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800";
  };

  const getMatchIcon = () => {
    if (tender.isMsmeExempted || tender.isStartupExempted) {
      return <Star className="w-3.5 h-3.5" />;
    }
    if (matchPct >= 75) {
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    }
    if (matchPct >= 50) {
      return <TrendingUp className="w-3.5 h-3.5" />;
    }
    return <AlertCircle className="w-3.5 h-3.5" />;
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "—";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 10000000) {
      return `${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `${(num / 100000).toFixed(2)} L`;
    }
    return `${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getEffectiveStatus = () => {
    if (tender.isManualOverride && tender.overrideStatus) {
      return tender.overrideStatus;
    }
    return tender.eligibilityStatus || 'eligible';
  };
  
  const effectiveStatus = getEffectiveStatus();
  const statusInfo = statusConfig[effectiveStatus] || defaultStatusInfo;
  const StatusIcon = statusInfo.icon;

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-shadow"
      onClick={onClick}
      data-testid={`card-tender-${tender.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">
                {tender.t247Id}
              </span>
              {tender.isCorrigendum && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                  Corrigendum
                </Badge>
              )}
              {tender.isManualOverride && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 flex items-center gap-1">
                      <PenLine className="w-3 h-3" />
                      Override
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{tender.overrideReason}</p>
                    {tender.overrideComment && (
                      <p className="text-xs text-muted-foreground mt-1">{tender.overrideComment}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-snug">
              {tender.title || "Untitled Tender"}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge 
              className={`flex items-center gap-1 ${getMatchColor()}`}
              variant="outline"
            >
              {getMatchIcon()}
              {tender.isMsmeExempted || tender.isStartupExempted 
                ? "Exempted" 
                : `${matchPct}%`}
            </Badge>
            <Badge 
              className={`flex items-center gap-1 text-xs ${statusInfo.color}`}
              variant="outline"
            >
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {tender.department && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="truncate">{tender.department}</span>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Est. Value</div>
              <div className="font-medium text-foreground">{formatCurrency(tender.estimatedValue)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">EMD</div>
              <div className="font-medium text-foreground">{formatCurrency(tender.emdAmount)}</div>
            </div>
          </div>
        </div>

        {tender.submissionDeadline && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <span className="text-muted-foreground">Deadline: </span>
              <span className="font-medium text-foreground">{formatDate(tender.submissionDeadline)}</span>
            </div>
          </div>
        )}

        {tender.notRelevantKeyword && (
          <div className="flex items-center gap-2 text-sm bg-gray-500/10 p-2 rounded-md">
            <Ban className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-muted-foreground text-xs">
              Matched keyword: <span className="font-medium">"{tender.notRelevantKeyword}"</span>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge 
              variant="outline" 
              className={tender.tenderType === 'gem' 
                ? "text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" 
                : "text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }
            >
              {tender.tenderType === 'gem' ? 'GEM' : 'Non-GEM'}
            </Badge>
            {tender.tags?.slice(0, 2).map((tag, index) => {
              const IconComponent = tagIcons[tag] || Code;
              return (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs flex items-center gap-1"
                >
                  <IconComponent className="w-3 h-3" />
                  {tag}
                </Badge>
              );
            })}
            {(tender.tags?.length || 0) > 2 && (
              <Badge variant="outline" className="text-xs">
                +{(tender.tags?.length || 0) - 2}
              </Badge>
            )}
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            data-testid={`button-view-tender-${tender.id}`}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Action Buttons */}
        {showQuickActions && effectiveStatus !== 'not_eligible' && effectiveStatus !== 'not_relevant' && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                  disabled={overrideMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    overrideMutation.mutate({ 
                      status: 'not_eligible', 
                      reason: 'Manually marked as Not Eligible' 
                    });
                  }}
                  data-testid={`button-quick-not-eligible-${tender.id}`}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Not Eligible
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark as Not Eligible (requirements not met)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs bg-gray-500/10 hover:bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                  disabled={overrideMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    overrideMutation.mutate({ 
                      status: 'not_relevant', 
                      reason: 'Manually marked as Not Relevant' 
                    });
                  }}
                  data-testid={`button-quick-not-relevant-${tender.id}`}
                >
                  <Ban className="w-3.5 h-3.5 mr-1" />
                  Not Relevant
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark as Not Relevant (not applicable to business)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
