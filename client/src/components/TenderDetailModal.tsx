import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  PenLine,
  ChevronDown,
  Undo2,
  Ban,
  XCircle,
  Loader2
} from "lucide-react";
import type { Tender } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

const overrideReasons = [
  { value: "wrong_categorization", label: "Wrong Categorization" },
  { value: "not_our_domain", label: "Not Our Domain/Industry" },
  { value: "too_small_value", label: "Contract Value Too Small" },
  { value: "deadline_passed", label: "Deadline Already Passed" },
  { value: "duplicate_tender", label: "Duplicate/Already Applied" },
  { value: "geographic_restriction", label: "Geographic Restriction" },
  { value: "experience_requirement", label: "Experience Requirement Not Met" },
  { value: "technical_requirement", label: "Technical Capability Not Met" },
  { value: "other", label: "Other Reason" },
];

export function TenderDetailModal({ tender, open, onClose, onViewCorrigendum }: TenderDetailModalProps) {
  const { toast } = useToast();
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideComment, setOverrideComment] = useState<string>("");

  const overrideMutation = useMutation({
    mutationFn: async (data: { overrideStatus: string; overrideReason: string; overrideComment: string }) => {
      return apiRequest("POST", `/api/tenders/${tender?.id}/override`, data);
    },
    onSuccess: () => {
      toast({
        title: "Override Applied",
        description: "The tender status has been manually overridden.",
      });
      setShowOverridePanel(false);
      setOverrideStatus("");
      setOverrideReason("");
      setOverrideComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tender?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_relevant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "manual_review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Override Failed",
        description: error.message || "Failed to override tender status",
        variant: "destructive",
      });
    },
  });

  const undoOverrideMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tenders/${tender?.id}/override`);
    },
    onSuccess: () => {
      toast({
        title: "Override Removed",
        description: "The tender will be re-analyzed with original criteria.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tender?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_relevant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "manual_review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed",
        description: error.message || "Failed to remove override",
        variant: "destructive",
      });
    },
  });

  if (!tender) return null;

  const matchPct = tender.matchPercentage ?? 0;

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
      return <Star className="w-4 h-4" />;
    }
    if (matchPct >= 75) {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    if (matchPct >= 50) {
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

  const formatTurnover = (value: string | number | null | undefined) => {
    if (!value) return "Not specified";
    const lakhValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(lakhValue) || lakhValue === 0) return "Not specified";
    
    // Display in Lakhs as stored (matching Excel format)
    const formatted = lakhValue % 1 === 0 ? lakhValue.toString() : lakhValue.toFixed(2);
    return `${formatted} Lakh`;
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

  const handleOverride = () => {
    if (!overrideStatus || !overrideReason) {
      toast({
        title: "Missing Information",
        description: "Please select both status and reason for override",
        variant: "destructive",
      });
      return;
    }
    
    const reasonLabel = overrideReasons.find(r => r.value === overrideReason)?.label || overrideReason;
    overrideMutation.mutate({
      overrideStatus,
      overrideReason: reasonLabel,
      overrideComment,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader className="pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                {tender.isManualOverride && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 flex items-center gap-1">
                    <PenLine className="w-3 h-3" />
                    Manual Override
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
                : `${matchPct}% Match`}
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

            {tender.isManualOverride && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <PenLine className="w-5 h-5" />
                    <span className="font-medium">Manual Override Active</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => undoOverrideMutation.mutate()}
                    disabled={undoOverrideMutation.isPending}
                    data-testid="button-undo-override"
                  >
                    {undoOverrideMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Undo2 className="w-4 h-4 mr-1" />
                        Undo Override
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 text-sm">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Reason:</span> {tender.overrideReason}
                  </p>
                  {tender.overrideComment && (
                    <p className="text-foreground mt-1">
                      <span className="text-muted-foreground">Comment:</span> {tender.overrideComment}
                    </p>
                  )}
                  {tender.overrideAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Overridden on {formatDate(tender.overrideAt)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {tender.notRelevantKeyword && (
              <div className="rounded-lg bg-gray-500/10 border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Ban className="w-5 h-5" />
                  <span className="font-medium">Matched Negative Keyword</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  This tender was marked as "Not Relevant" because it contains the keyword: 
                  <span className="font-medium text-foreground ml-1">"{tender.notRelevantKeyword}"</span>
                </p>
              </div>
            )}

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
                    <div className="text-sm font-medium text-foreground">{formatTurnover(tender.turnoverRequirement)}</div>
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
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-md bg-amber-500/10">
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">Eligibility Criteria</h4>
                  </div>
                  <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                    <div className="space-y-3">
                      {tender.eligibilityCriteria.split(/[•\n]/).filter(item => item.trim()).map((item, index) => {
                        const trimmedItem = item.trim();
                        if (!trimmedItem) return null;
                        
                        const hasTurnover = /turnover|lakh|crore|financial/i.test(trimmedItem);
                        const hasExperience = /experience|year|years/i.test(trimmedItem);
                        const hasBlacklist = /black.?list|ban|debar/i.test(trimmedItem);
                        const isHeading = trimmedItem.includes(':') && !trimmedItem.includes('should') && trimmedItem.length < 150;
                        
                        if (isHeading && !hasTurnover && !hasExperience) {
                          return (
                            <div key={index} className="font-medium text-foreground text-sm border-b border-amber-200 dark:border-amber-700 pb-2 mb-2">
                              {trimmedItem}
                            </div>
                          );
                        }
                        
                        return (
                          <div 
                            key={index} 
                            className={`flex items-start gap-3 text-sm rounded-md p-2 -mx-2 ${
                              hasTurnover 
                                ? 'bg-blue-500/10 border border-blue-200 dark:border-blue-800' 
                                : hasExperience 
                                  ? 'bg-purple-500/10 border border-purple-200 dark:border-purple-800'
                                  : hasBlacklist
                                    ? 'bg-red-500/10 border border-red-200 dark:border-red-800'
                                    : ''
                            }`}
                          >
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              hasTurnover 
                                ? 'bg-blue-500' 
                                : hasExperience 
                                  ? 'bg-purple-500'
                                  : hasBlacklist
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                            }`} />
                            <span className={`${
                              hasTurnover || hasExperience || hasBlacklist 
                                ? 'font-medium text-foreground' 
                                : 'text-muted-foreground'
                            }`}>
                              {trimmedItem}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Turnover Related</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>Experience Required</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Restrictions</span>
                    </div>
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

            {!tender.isManualOverride && (
              <>
                <Separator />
                <Collapsible open={showOverridePanel} onOpenChange={setShowOverridePanel}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between"
                      data-testid="button-toggle-override"
                    >
                      <span className="flex items-center gap-2">
                        <PenLine className="w-4 h-4" />
                        Manual Override Status
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showOverridePanel ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Override the automated categorization if you believe it's incorrect.
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5">
                          Change Status To
                        </label>
                        <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                          <SelectTrigger data-testid="select-override-status">
                            <SelectValue placeholder="Select new status..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_eligible">
                              <span className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-500" />
                                Not Eligible
                              </span>
                            </SelectItem>
                            <SelectItem value="not_relevant">
                              <span className="flex items-center gap-2">
                                <Ban className="w-4 h-4 text-gray-500" />
                                Not Relevant
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5">
                          Reason for Override
                        </label>
                        <Select value={overrideReason} onValueChange={setOverrideReason}>
                          <SelectTrigger data-testid="select-override-reason">
                            <SelectValue placeholder="Select reason..." />
                          </SelectTrigger>
                          <SelectContent>
                            {overrideReasons.map((reason) => (
                              <SelectItem key={reason.value} value={reason.value}>
                                {reason.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1.5">
                          Additional Comment (Optional)
                        </label>
                        <Textarea
                          placeholder="Add any additional notes..."
                          value={overrideComment}
                          onChange={(e) => setOverrideComment(e.target.value)}
                          className="resize-none"
                          rows={2}
                          data-testid="textarea-override-comment"
                        />
                      </div>

                      <Button
                        onClick={handleOverride}
                        disabled={!overrideStatus || !overrideReason || overrideMutation.isPending}
                        className="w-full"
                        data-testid="button-apply-override"
                      >
                        {overrideMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <PenLine className="w-4 h-4 mr-2" />
                            Apply Override
                          </>
                        )}
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
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
