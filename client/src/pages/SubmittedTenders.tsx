import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Loader2,
  IndianRupee,
  Calendar,
  FileText,
  User,
  Building2,
  Hash,
  Search,
  X,
  ExternalLink,
  Trophy,
  Presentation,
  HelpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  FileCheck,
  Users,
  Phone,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import type { BiddingSubmission, Tender, TenderAssignment, TeamMember, TenderResult, Presentation as PresentationType, Clarification } from "@shared/schema";

type SubmissionWithDetails = BiddingSubmission & {
  tender?: Tender;
  assignment?: TenderAssignment;
  submitter?: Omit<TeamMember, "password">;
};

type TenderResultWithDetails = TenderResult & {
  tender?: Tender;
  updatedByMember?: Omit<TeamMember, "password">;
};

type PresentationWithDetails = PresentationType & {
  tender?: Tender;
  assignee?: Omit<TeamMember, "password">;
};

type ClarificationWithDetails = Clarification & {
  tender?: Tender;
  assignee?: Omit<TeamMember, "password">;
};

interface DepartmentContact {
  name: string;
  phone: string;
  email: string;
}

function formatLakhs(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num.toLocaleString("en-IN")} L`;
}

const resultStatusConfig: Record<string, { label: string; color: string; icon: typeof Trophy }> = {
  technical_qualified: { label: "Technical Qualified", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: FileCheck },
  technical_not_qualified: { label: "Technical Not Qualified", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  financial_evaluation: { label: "Financial Evaluation", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: IndianRupee },
  l1: { label: "L1", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: Award },
  l2: { label: "L2", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Trophy },
  l3_or_below: { label: "L3 or Below", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: Trophy },
  won: { label: "Won", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  lost: { label: "Lost", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300", icon: AlertCircle },
};

const presentationStatusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  postponed: { label: "Postponed", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
};

const clarificationStageConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

export default function SubmittedTenders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: submissions = [], isLoading } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/submissions"],
  });

  const { data: workflowStats } = useQuery<{
    assigned: number;
    inProgress: number;
    readyForReview: number;
    submitted: number;
    totalBudget: number;
  }>({
    queryKey: ["/api/workflow-stats"],
  });

  const { data: tenderResults = [] } = useQuery<TenderResultWithDetails[]>({
    queryKey: ["/api/tender-results"],
  });

  const { data: presentations = [] } = useQuery<PresentationWithDetails[]>({
    queryKey: ["/api/presentations"],
  });

  const { data: clarifications = [] } = useQuery<ClarificationWithDetails[]>({
    queryKey: ["/api/clarifications"],
  });

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;
    const query = searchQuery.toLowerCase();
    return submissions.filter((submission) => {
      const tender = submission.tender;
      return (
        tender?.title?.toLowerCase().includes(query) ||
        tender?.t247Id?.toLowerCase().includes(query) ||
        tender?.department?.toLowerCase().includes(query) ||
        tender?.organization?.toLowerCase().includes(query) ||
        submission.portalReferenceNumber?.toLowerCase().includes(query) ||
        submission.submitter?.fullName?.toLowerCase().includes(query)
      );
    });
  }, [submissions, searchQuery]);

  const getResultForSubmission = (submission: SubmissionWithDetails) => {
    const tender = submission.tender;
    if (!tender) return null;
    
    return tenderResults.find(
      (result) => 
        result.tenderId === tender.id || 
        result.referenceId === tender.t247Id
    );
  };

  const getPresentationsForTender = (tender: Tender | undefined) => {
    if (!tender) return [];
    return presentations.filter(
      (p) => p.tenderId === tender.id || p.referenceId === tender.t247Id
    );
  };

  const getClarificationsForTender = (tender: Tender | undefined) => {
    if (!tender) return [];
    return clarifications.filter(
      (c) => c.tenderId === tender.id || c.referenceId === tender.t247Id
    );
  };

  const handleViewDetails = (submission: SubmissionWithDetails) => {
    setSelectedSubmission(submission);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedTenderResult = selectedSubmission ? getResultForSubmission(selectedSubmission) : null;
  const selectedPresentations = selectedSubmission ? getPresentationsForTender(selectedSubmission.tender) : [];
  const selectedClarifications = selectedSubmission ? getClarificationsForTender(selectedSubmission.tender) : [];

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Send className="h-6 w-6" />
            Submitted Tenders
          </h1>
          <p className="text-muted-foreground mt-1">
            View all tenders that have been submitted to the portal
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Submitted</CardDescription>
              <CardTitle className="text-3xl">{submissions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Budget Submitted</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-1">
                <IndianRupee className="h-6 w-6" />
                {formatLakhs(workflowStats?.totalBudget || 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ready for Review</CardDescription>
              <CardTitle className="text-3xl text-amber-600">
                {workflowStats?.readyForReview || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {workflowStats?.inProgress || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Submission History
                </CardTitle>
                <CardDescription>
                  All tender submissions made to the portal
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, ID, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  data-testid="input-search-submissions"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {searchQuery ? (
                  <>
                    <p>No submissions match your search</p>
                    <p className="text-sm">Try adjusting your search terms</p>
                  </>
                ) : (
                  <>
                    <p>No submissions yet</p>
                    <p className="text-sm">Tenders will appear here once submitted to the portal</p>
                  </>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tender</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submission Date</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Result Status</TableHead>
                    <TableHead>Portal Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => {
                    const result = getResultForSubmission(submission);
                    const statusConfig = result?.currentStatus ? resultStatusConfig[result.currentStatus] : null;
                    const StatusIcon = statusConfig?.icon || Trophy;
                    
                    return (
                      <TableRow key={submission.id} data-testid={`row-submission-${submission.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <button
                              className="font-medium line-clamp-2 text-left hover:text-primary hover:underline cursor-pointer"
                              onClick={() => handleViewDetails(submission)}
                              data-testid={`button-view-tender-${submission.id}`}
                            >
                              {submission.tender?.title || "Unknown Tender"}
                            </button>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {submission.tender?.t247Id || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {submission.tender?.department || submission.tender?.organization || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {submission.submitter?.fullName || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {submission.submissionDate
                              ? format(new Date(submission.submissionDate), "MMM d, yyyy")
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <IndianRupee className="h-3 w-3" />
                            {formatLakhs(submission.submittedBudget)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {statusConfig ? (
                            <Badge className={`${statusConfig.color} gap-1`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50 text-sm">Not tracked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {submission.portalReferenceNumber ? (
                            <Badge variant="outline">
                              {submission.portalReferenceNumber}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {submissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Submission Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {submissions.filter(s => s.notes).map((submission) => (
                  <div key={submission.id} className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {submission.tender?.t247Id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {submission.submissionDate
                          ? format(new Date(submission.submissionDate), "MMM d, yyyy")
                          : "-"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{submission.notes}</p>
                  </div>
                ))}
                {submissions.filter(s => s.notes).length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No notes attached to any submissions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tender Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this tender submission
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedSubmission.tender?.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    <span>{selectedSubmission.tender?.t247Id}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Department</span>
                    <p className="font-medium flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {selectedSubmission.tender?.department || selectedSubmission.tender?.organization || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Estimated Value</span>
                    <p className="font-medium flex items-center gap-1">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      {formatLakhs(selectedSubmission.tender?.estimatedValue)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Submitted By</span>
                    <p className="font-medium flex items-center gap-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedSubmission.submitter?.fullName || "Unknown"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Submission Date</span>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {selectedSubmission.submissionDate
                        ? format(new Date(selectedSubmission.submissionDate), "MMM d, yyyy")
                        : "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Submitted Budget</span>
                    <Badge variant="secondary" className="gap-1 text-base">
                      <IndianRupee className="h-4 w-4" />
                      {formatLakhs(selectedSubmission.submittedBudget)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Portal Reference</span>
                    <p className="font-medium">
                      {selectedSubmission.portalReferenceNumber || "-"}
                    </p>
                  </div>
                </div>

                {selectedSubmission.notes && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="p-3 rounded-lg bg-muted/50 border text-sm">
                      {selectedSubmission.notes}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Result Status
                </h4>
                {selectedTenderResult ? (
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const config = resultStatusConfig[selectedTenderResult.currentStatus];
                          const Icon = config?.icon || Trophy;
                          return (
                            <>
                              <Badge className={`${config?.color || ''} gap-1`}>
                                <Icon className="h-3 w-3" />
                                {config?.label || selectedTenderResult.currentStatus}
                              </Badge>
                            </>
                          );
                        })()}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Updated {selectedTenderResult.updatedAt ? format(new Date(selectedTenderResult.updatedAt), "MMM d, yyyy") : "-"}
                      </span>
                    </div>
                    {selectedTenderResult.updatedByMember && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Updated by {selectedTenderResult.updatedByMember.fullName}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border bg-muted/30 text-center text-muted-foreground">
                    <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No result status tracked yet</p>
                    <p className="text-sm">Add a result in the Tender Results page</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Presentation className="h-4 w-4" />
                  Presentations ({selectedPresentations.length})
                </h4>
                {selectedPresentations.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPresentations.map((presentation) => {
                      const statusConfig = presentationStatusConfig[presentation.status || 'scheduled'];
                      return (
                        <div key={presentation.id} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={statusConfig?.color || ''}>
                              {statusConfig?.label || presentation.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {presentation.scheduledDate
                                ? format(new Date(presentation.scheduledDate), "MMM d, yyyy")
                                : "-"}
                              {presentation.scheduledTime && ` at ${presentation.scheduledTime}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {presentation.assignee?.fullName || "Unassigned"}
                          </div>
                          {presentation.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{presentation.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border bg-muted/30 text-center text-muted-foreground">
                    <Presentation className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No presentations scheduled</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Clarifications ({selectedClarifications.length})
                </h4>
                {selectedClarifications.length > 0 ? (
                  <div className="space-y-3">
                    {selectedClarifications.map((clarification) => {
                      const stageConfig = clarificationStageConfig[clarification.currentStage || 'pending'];
                      const contacts = (clarification.departmentContacts as DepartmentContact[]) || [];
                      return (
                        <div key={clarification.id} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={stageConfig?.color || ''}>
                              {stageConfig?.label || clarification.currentStage}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {clarification.createdAt
                                ? format(new Date(clarification.createdAt), "MMM d, yyyy")
                                : "-"}
                            </span>
                          </div>
                          <p className="text-sm mb-2">{clarification.clarificationDetails}</p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            Assigned to: {clarification.assignee?.fullName || "Unassigned"}
                          </div>
                          {contacts.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {contacts.map((contact, idx) => (
                                <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{contact.name}</span>
                                  {contact.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                  {contact.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {contact.email}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {clarification.responseDetails && (
                            <div className="mt-2 p-2 rounded bg-muted text-sm">
                              <span className="font-medium">Response:</span> {clarification.responseDetails}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border bg-muted/30 text-center text-muted-foreground">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No clarifications tracked</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
