import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  IndianRupee, 
  Building2, 
  Star,
  FileText,
  AlertCircle,
  CheckCircle2,
  Users,
  Code,
  Globe,
  Smartphone,
  Monitor,
  TrendingUp,
  ExternalLink,
  Copy,
  X
} from "lucide-react";
import type { Tender } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface TenderDetailModalProps {
  tender: Tender | null;
  open: boolean;
  onClose: () => void;
  onViewCorrigendum?: () => void;
}

const tagIcons: Record<string, React.ElementType> = {
  'Manpower': Users,
  'IT': Monitor,
  'Software': Code,
  'Website': Globe,
  'Mobile': Smartphone,
};

export function TenderDetailModal({ tender, open, onClose, onViewCorrigendum }: TenderDetailModalProps) {
  const { toast } = useToast();

  if (!tender) return null;

  const getMatchColor = () => {
    if (tender.isMsmeExempted || tender.isStartupExempted) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800";
    }
    if (tender.matchPercentage >= 100) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    }
    if (tender.matchPercentage >= 75) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    }
    if (tender.matchPercentage >= 50) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    }
    if (tender.matchPercentage >= 25) {
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    }
    return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800";
  };

  const getMatchIcon = () => {
    if (tender.isMsmeExempted || tender.isStartupExempted) {
      return <Star className="w-4 h-4" />;
    }
    if (tender.matchPercentage >= 75) {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    if (tender.matchPercentage >= 50) {
      return <TrendingUp className="w-4 h-4" />;
    }
    return <AlertCircle className="w-4 h-4" />;
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "Not specified";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Crore`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)} Lakh`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Not specified";
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Tender ID copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader className="pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <button 
                  onClick={() => copyToClipboard(tender.t247Id)}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  data-testid="button-copy-tender-id"
                >
                  {tender.t247Id}
                  <Copy className="w-3 h-3" />
                </button>
                {tender.isCorrigendum && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                    Corrigendum
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-lg leading-snug">
                {tender.title || "Untitled Tender"}
              </DialogTitle>
            </div>
            <Badge 
              className={`shrink-0 flex items-center gap-1.5 text-sm ${getMatchColor()}`}
              variant="outline"
            >
              {getMatchIcon()}
              {tender.isMsmeExempted || tender.isStartupExempted 
                ? "MSME Exempted" 
                : `${tender.matchPercentage}% Match`}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            <div className="flex flex-wrap gap-2">
              <Badge 
                variant="outline" 
                className={tender.tenderType === 'gem' 
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" 
                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                }
              >
                {tender.tenderType === 'gem' ? 'GEM Portal' : 'Non-GEM'}
              </Badge>
              {tender.tags?.map((tag, index) => {
                const IconComponent = tagIcons[tag] || Code;
                return (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="flex items-center gap-1"
                  >
                    <IconComponent className="w-3 h-3" />
                    {tag}
                  </Badge>
                );
              })}
            </div>

            {(tender.isMsmeExempted || tender.isStartupExempted) && (
              <div className="rounded-lg bg-purple-500/10 border border-purple-200 dark:border-purple-800 p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Star className="w-5 h-5" />
                  <span className="font-medium">Turnover Exemption Applicable</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {tender.isMsmeExempted && tender.isStartupExempted 
                    ? "This tender exempts turnover requirements for both MSMEs and Startups."
                    : tender.isMsmeExempted 
                      ? "This tender exempts turnover requirements for MSMEs."
                      : "This tender exempts turnover requirements for Startups."}
                </p>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Organization Details</h4>
              <div className="space-y-2">
                {tender.department && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Department</div>
                      <div className="text-sm text-foreground">{tender.department}</div>
                    </div>
                  </div>
                )}
                {tender.organization && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Organization</div>
                      <div className="text-sm text-foreground">{tender.organization}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Financial Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <IndianRupee className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Estimated Value</div>
                    <div className="text-sm font-medium text-foreground">{formatCurrency(tender.estimatedValue)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">EMD Amount</div>
                    <div className="text-sm font-medium text-foreground">{formatCurrency(tender.emdAmount)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Turnover Requirement</div>
                    <div className="text-sm font-medium text-foreground">{formatCurrency(tender.turnoverRequirement)}</div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Important Dates</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Publish Date</div>
                    <div className="text-sm text-foreground">{formatDate(tender.publishDate)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Submission Deadline</div>
                    <div className="text-sm font-medium text-foreground">{formatDate(tender.submissionDeadline)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Opening Date</div>
                    <div className="text-sm text-foreground">{formatDate(tender.openingDate)}</div>
                  </div>
                </div>
              </div>
            </div>

            {tender.eligibilityCriteria && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Eligibility Criteria</h4>
                  <div className="rounded-lg bg-muted/50 p-4 text-sm text-foreground whitespace-pre-wrap">
                    {tender.eligibilityCriteria}
                  </div>
                </div>
              </>
            )}

            {tender.checklist && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Checklist</h4>
                  <div className="rounded-lg bg-muted/50 p-4 text-sm text-foreground whitespace-pre-wrap">
                    {tender.checklist}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {tender.isCorrigendum && onViewCorrigendum && (
            <Button 
              variant="outline" 
              onClick={onViewCorrigendum}
              data-testid="button-view-corrigendum-changes"
            >
              View Changes
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          )}
          <Button onClick={onClose} data-testid="button-close-detail">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
