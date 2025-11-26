import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Briefcase, 
  Loader2,
  Play,
  Eye,
  Send,
  Clock,
  Building2,
  Hash,
  ArrowRight,
  IndianRupee,
  Calendar,
  AlertTriangle,
  Flag,
  Timer,
  CheckCircle2,
  HandMetal,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, isPast, differenceInDays } from "date-fns";
import { AssignTenderDialog } from "@/components/AssignTenderDialog";
import type { TenderAssignment, Tender, TeamMember } from "@shared/schema";

type AssignmentWithDetails = TenderAssignment & {
  tender?: Tender;
  assignee?: Omit<TeamMember, "password">;
  assigner?: Omit<TeamMember, "password">;
};

const stageConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; progress: number }> = {
  assigned: { label: "Assigned", icon: Clock, color: "text-slate-600 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800", progress: 25 },
  in_progress: { label: "In Progress", icon: Play, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900", progress: 50 },
  ready_for_review: { label: "Ready for Review", icon: Eye, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900", progress: 75 },
  submitted: { label: "Submitted", icon: Send, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900", progress: 100 },
};

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-slate-500", bgColor: "bg-slate-100 dark:bg-slate-800" },
  normal: { label: "Normal", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900" },
  high: { label: "High", color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900" },
  urgent: { label: "Urgent", color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-900" },
};

function formatLakhs(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num.toLocaleString("en-IN")} L`;
}

function getDeadlineStatus(deadline: string | Date | null | undefined): { color: string; label: string; urgent: boolean } {
  if (!deadline) return { color: "text-muted-foreground", label: "No deadline", urgent: false };
  
  const deadlineDate = new Date(deadline);
  const daysLeft = differenceInDays(deadlineDate, new Date());
  
  if (isPast(deadlineDate)) {
    return { color: "text-red-600 dark:text-red-400", label: "Overdue", urgent: true };
  } else if (daysLeft <= 2) {
    return { color: "text-red-500", label: `${daysLeft} days left`, urgent: true };
  } else if (daysLeft <= 5) {
    return { color: "text-amber-500", label: `${daysLeft} days left`, urgent: false };
  } else {
    return { color: "text-muted-foreground", label: `${daysLeft} days left`, urgent: false };
  }
}

export default function MyWork() {
  const { toast } = useToast();
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [submissionBudget, setSubmissionBudget] = useState("");
  const [submissionRef, setSubmissionRef] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [activeTab, setActiveTab] = useState("my-work");
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [tenderToClaim, setTenderToClaim] = useState<Tender | null>(null);

  const { data: myAssignments = [], isLoading } = useQuery<AssignmentWithDetails[]>({
    queryKey: ["/api/assignments/my"],
  });

  const { data: currentTeamMember } = useQuery<Omit<TeamMember, "password">>({
    queryKey: ["/api/me/team-member"],
    retry: false,
  });

  const { data: allAssignments = [] } = useQuery<TenderAssignment[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: eligibleTenders = [] } = useQuery<Tender[]>({
    queryKey: ["/api/tenders/status", "eligible"],
  });

  const assignedTenderIds = useMemo(() => {
    return new Set(allAssignments.map(a => a.tenderId));
  }, [allAssignments]);

  const availableTenders = useMemo(() => {
    return eligibleTenders.filter(t => !assignedTenderIds.has(t.id));
  }, [eligibleTenders, assignedTenderIds]);

  const handleClaimTender = (tender: Tender) => {
    setTenderToClaim(tender);
    setClaimDialogOpen(true);
  };

  const updateStageMutation = useMutation({
    mutationFn: async (data: { id: number; stage: string; changedBy: number; note?: string }) => {
      return apiRequest("POST", `/api/assignments/${data.id}/stage`, {
        stage: data.stage,
        changedBy: data.changedBy,
        note: data.note,
      });
    },
    onSuccess: () => {
      toast({
        title: "Progress Updated",
        description: "Your work status has been updated.",
      });
      setStageDialogOpen(false);
      setSelectedAssignment(null);
      setNewStage("");
      setStageNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update your work status.",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: {
      tenderId: number;
      assignmentId: number;
      submittedBy: number;
      submittedBudget: string;
      submissionDate: string;
      portalReferenceNumber?: string;
      notes?: string;
    }) => {
      return apiRequest("POST", "/api/submissions", data);
    },
    onSuccess: () => {
      toast({
        title: "Bid Submitted",
        description: "Your bid has been recorded successfully.",
      });
      setSubmitDialogOpen(false);
      setSelectedAssignment(null);
      setSubmissionBudget("");
      setSubmissionRef("");
      setSubmissionNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to record your bid submission.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateProgress = (assignment: AssignmentWithDetails, nextStage: string) => {
    if (!currentTeamMember) {
      toast({
        title: "Error",
        description: "User not found in team members.",
        variant: "destructive",
      });
      return;
    }
    
    if (nextStage === "submitted") {
      setSelectedAssignment(assignment);
      setSubmitDialogOpen(true);
    } else {
      setSelectedAssignment(assignment);
      setNewStage(nextStage);
      setStageDialogOpen(true);
    }
  };

  const confirmStageUpdate = () => {
    if (!selectedAssignment || !newStage || !currentTeamMember) return;
    updateStageMutation.mutate({
      id: selectedAssignment.id,
      stage: newStage,
      changedBy: currentTeamMember.id,
      note: stageNote || undefined,
    });
  };

  const confirmSubmission = () => {
    if (!selectedAssignment || !submissionBudget || !currentTeamMember) return;
    submitMutation.mutate({
      tenderId: selectedAssignment.tenderId,
      assignmentId: selectedAssignment.id,
      submittedBy: currentTeamMember.id,
      submittedBudget: submissionBudget,
      submissionDate: new Date().toISOString(),
      portalReferenceNumber: submissionRef || undefined,
      notes: submissionNote || undefined,
    });
  };

  const getNextStage = (currentStage: string): string | null => {
    const stages = ["assigned", "in_progress", "ready_for_review", "submitted"];
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
  };

  const activeAssignments = myAssignments.filter(a => a.currentStage !== "submitted");
  const completedAssignments = myAssignments.filter(a => a.currentStage === "submitted");
  const urgentAssignments = activeAssignments.filter(a => {
    const deadline = a.tender?.submissionDeadline;
    if (!deadline) return false;
    return differenceInDays(new Date(deadline), new Date()) <= 3;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6" />
            My Work
          </h1>
          <p className="text-muted-foreground mt-1">
            Your assigned tenders and tasks
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <Card className={`hover-elevate ${availableTenders.length > 0 ? "border-blue-200 dark:border-blue-800" : ""}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className={`text-2xl font-bold ${availableTenders.length > 0 ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
                    {availableTenders.length}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
                  <p className="text-2xl font-bold text-foreground">{activeAssignments.length}</p>
                </div>
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                  <Play className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`hover-elevate ${urgentAssignments.length > 0 ? "border-red-200 dark:border-red-800" : ""}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Urgent (3 days)</p>
                  <p className={`text-2xl font-bold ${urgentAssignments.length > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                    {urgentAssignments.length}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${urgentAssignments.length > 0 ? "bg-red-100 dark:bg-red-900" : "bg-slate-100 dark:bg-slate-800"}`}>
                  <AlertTriangle className={`w-5 h-5 ${urgentAssignments.length > 0 ? "text-red-600 dark:text-red-400" : "text-slate-500"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{completedAssignments.length}</p>
                </div>
                <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="my-work" data-testid="tab-my-work">
              My Work ({myAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="available" data-testid="tab-available">
              Available to Claim ({availableTenders.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 p-6">
        {activeTab === "available" ? (
          availableTenders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">All tenders assigned</p>
              <p className="text-sm">No eligible tenders available for claiming at the moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <HandMetal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-foreground">Claim a Tender</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                These eligible tenders are available for you to claim. Click "Claim" to assign it to yourself.
              </p>
              <div className="grid gap-4">
                {availableTenders.map((tender) => {
                  const deadline = tender.submissionDeadline;
                  const deadlineStatus = getDeadlineStatus(deadline);
                  
                  return (
                    <Card key={tender.id} className="hover-elevate" data-testid={`card-available-${tender.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900 shrink-0">
                            <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="font-medium text-foreground truncate">
                                  {tender.title || "Untitled Tender"}
                                </h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    {tender.t247Id}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {tender.department?.slice(0, 30) || "-"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm shrink-0">
                                <IndianRupee className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{formatLakhs(tender.estimatedValue)}</span>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                              <div className={`flex items-center gap-2 text-sm ${deadlineStatus.color}`}>
                                <Timer className="w-4 h-4" />
                                {deadline ? (
                                  <>
                                    <span>{format(new Date(deadline), "dd MMM yyyy")}</span>
                                    <span>({deadlineStatus.label})</span>
                                  </>
                                ) : (
                                  <span>No deadline set</span>
                                )}
                              </div>
                              <Button
                                onClick={() => handleClaimTender(tender)}
                                className="gap-1"
                                data-testid={`button-claim-${tender.id}`}
                              >
                                <HandMetal className="w-4 h-4" />
                                Claim Tender
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )
        ) : myAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Briefcase className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No assignments yet</p>
            <p className="text-sm">Check the "Available to Claim" tab to find tenders you can work on</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeAssignments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Active Tasks ({activeAssignments.length})
                </h2>
                <div className="grid gap-4">
                  {activeAssignments
                    .sort((a, b) => {
                      const aDeadline = a.tender?.submissionDeadline ? new Date(a.tender.submissionDeadline).getTime() : Infinity;
                      const bDeadline = b.tender?.submissionDeadline ? new Date(b.tender.submissionDeadline).getTime() : Infinity;
                      return aDeadline - bDeadline;
                    })
                    .map((assignment) => {
                      const config = stageConfig[assignment.currentStage || "assigned"];
                      const prioConfig = priorityConfig[assignment.priority || "normal"];
                      const StageIcon = config?.icon || Clock;
                      const nextStage = getNextStage(assignment.currentStage || "assigned");
                      const deadline = assignment.tender?.submissionDeadline;
                      const deadlineStatus = getDeadlineStatus(deadline);

                      return (
                        <Card key={assignment.id} className={`hover-elevate ${deadlineStatus.urgent ? "border-red-200 dark:border-red-800" : ""}`} data-testid={`card-assignment-${assignment.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-lg ${config?.bgColor} shrink-0`}>
                                <StageIcon className={`w-5 h-5 ${config?.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <h3 className="font-medium text-foreground truncate">
                                      {assignment.tender?.title || "Unknown Tender"}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        {assignment.tender?.t247Id}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Building2 className="w-3 h-3" />
                                        {assignment.tender?.department?.slice(0, 30) || "-"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className={`${prioConfig?.bgColor} ${prioConfig?.color} border-0`}>
                                      <Flag className="w-3 h-3 mr-1" />
                                      {prioConfig?.label}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="mt-4 flex items-center gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                      <span>{config?.label}</span>
                                      <span>{config?.progress}%</span>
                                    </div>
                                    <Progress value={config?.progress} className="h-2" />
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <IndianRupee className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">{formatLakhs(assignment.tender?.estimatedValue)}</span>
                                  </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                  <div className={`flex items-center gap-2 text-sm ${deadlineStatus.color}`}>
                                    <Timer className="w-4 h-4" />
                                    {deadline ? (
                                      <>
                                        <span>{format(new Date(deadline), "dd MMM yyyy")}</span>
                                        <span>({deadlineStatus.label})</span>
                                      </>
                                    ) : (
                                      <span>No deadline set</span>
                                    )}
                                  </div>
                                  {nextStage && (
                                    <Button
                                      onClick={() => handleUpdateProgress(assignment, nextStage)}
                                      className="gap-1"
                                      data-testid={`button-progress-${assignment.id}`}
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                      {nextStage === "submitted" ? "Submit Bid" : `Mark ${stageConfig[nextStage]?.label}`}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {completedAssignments.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Completed ({completedAssignments.length})
                </h2>
                <div className="grid gap-4">
                  {completedAssignments.map((assignment) => (
                    <Card key={assignment.id} className="opacity-75" data-testid={`card-completed-${assignment.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900 shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">
                              {assignment.tender?.title || "Unknown Tender"}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {assignment.tender?.t247Id}
                              </span>
                              <span className="flex items-center gap-1">
                                <IndianRupee className="w-3 h-3" />
                                {formatLakhs(assignment.tender?.estimatedValue)}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 border-0 shrink-0">
                            Submitted
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
            <DialogDescription>
              Update your work status for "{selectedAssignment?.tender?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Badge variant="outline" className={`${stageConfig[selectedAssignment?.currentStage || "assigned"]?.bgColor} ${stageConfig[selectedAssignment?.currentStage || "assigned"]?.color} border-0`}>
                {stageConfig[selectedAssignment?.currentStage || "assigned"]?.label}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline" className={`${stageConfig[newStage]?.bgColor} ${stageConfig[newStage]?.color} border-0`}>
                {stageConfig[newStage]?.label}
              </Badge>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Add a note about your progress..."
                className="mt-1"
                data-testid="input-stage-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmStageUpdate} disabled={updateStageMutation.isPending} data-testid="button-confirm-progress">
              {updateStageMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Bid</DialogTitle>
            <DialogDescription>
              Record your bid submission for "{selectedAssignment?.tender?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Value:</span>
                <span className="font-medium">{formatLakhs(selectedAssignment?.tender?.estimatedValue)}</span>
              </div>
            </div>
            <div>
              <Label>Your Bid Amount (in Lakhs) *</Label>
              <div className="relative mt-1">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={submissionBudget}
                  onChange={(e) => setSubmissionBudget(e.target.value)}
                  placeholder="Enter your bid amount in Lakhs"
                  className="pl-9"
                  data-testid="input-bid-amount"
                />
              </div>
            </div>
            <div>
              <Label>Portal Reference Number</Label>
              <Input
                value={submissionRef}
                onChange={(e) => setSubmissionRef(e.target.value)}
                placeholder="e.g., GEM/2024/B/12345"
                className="mt-1"
                data-testid="input-portal-ref"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                placeholder="Any additional notes..."
                className="mt-1"
                data-testid="input-bid-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmSubmission} 
              disabled={!submissionBudget || submitMutation.isPending}
              data-testid="button-submit-bid"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignTenderDialog
        tender={tenderToClaim}
        open={claimDialogOpen}
        onClose={() => {
          setClaimDialogOpen(false);
          setTenderToClaim(null);
        }}
        selfAssign={true}
      />
    </div>
  );
}
