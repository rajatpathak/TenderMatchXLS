import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Workflow, 
  Loader2,
  Play,
  Eye,
  Send,
  Clock,
  User,
  Building2,
  Hash,
  ArrowRight,
  IndianRupee,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { TenderAssignment, Tender, TeamMember } from "@shared/schema";

type AssignmentWithDetails = TenderAssignment & {
  tender?: Tender;
  assignee?: Omit<TeamMember, "password">;
  assigner?: Omit<TeamMember, "password">;
};

const stageConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  assigned: { label: "Assigned", icon: Clock, color: "text-slate-600", bgColor: "bg-slate-100" },
  in_progress: { label: "In Progress", icon: Play, color: "text-blue-600", bgColor: "bg-blue-100" },
  ready_for_review: { label: "Ready for Review", icon: Eye, color: "text-amber-600", bgColor: "bg-amber-100" },
  submitted: { label: "Submitted", icon: Send, color: "text-emerald-600", bgColor: "bg-emerald-100" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-slate-500" },
  normal: { label: "Normal", color: "text-blue-500" },
  high: { label: "High", color: "text-orange-500" },
  urgent: { label: "Urgent", color: "text-red-500" },
};

function formatLakhs(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num.toLocaleString("en-IN")} L`;
}

export default function WorkflowPage() {
  const { toast } = useToast();
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [submissionBudget, setSubmissionBudget] = useState("");
  const [submissionRef, setSubmissionRef] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: assignments = [], isLoading } = useQuery<AssignmentWithDetails[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: teamMembers = [] } = useQuery<Omit<TeamMember, "password">[]>({
    queryKey: ["/api/team-members"],
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
        title: "Stage Updated",
        description: "The workflow stage has been updated successfully.",
      });
      setStageDialogOpen(false);
      setSelectedAssignment(null);
      setNewStage("");
      setStageNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage",
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
        title: "Tender Submitted",
        description: "The tender has been marked as submitted to the portal.",
      });
      setSubmitDialogOpen(false);
      setSelectedAssignment(null);
      setSubmissionBudget("");
      setSubmissionRef("");
      setSubmissionNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit tender",
        variant: "destructive",
      });
    },
  });

  const handleStageUpdate = (assignment: AssignmentWithDetails) => {
    setSelectedAssignment(assignment);
    setNewStage(assignment.currentStage || "assigned");
    setStageDialogOpen(true);
  };

  const handleSubmit = (assignment: AssignmentWithDetails) => {
    setSelectedAssignment(assignment);
    setSubmitDialogOpen(true);
  };

  const confirmStageUpdate = () => {
    if (!selectedAssignment || !newStage) return;
    const currentUser = teamMembers.find(m => m.role === "admin" || m.role === "manager") || teamMembers[0];
    if (!currentUser) {
      toast({
        title: "Error",
        description: "No team member found to record the change",
        variant: "destructive",
      });
      return;
    }
    updateStageMutation.mutate({
      id: selectedAssignment.id,
      stage: newStage,
      changedBy: currentUser.id,
      note: stageNote || undefined,
    });
  };

  const confirmSubmission = () => {
    if (!selectedAssignment || !submissionBudget) return;
    const currentUser = teamMembers.find(m => m.role === "admin" || m.role === "manager") || teamMembers[0];
    if (!currentUser) {
      toast({
        title: "Error",
        description: "No team member found to record the submission",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate({
      tenderId: selectedAssignment.tenderId,
      assignmentId: selectedAssignment.id,
      submittedBy: currentUser.id,
      submittedBudget: submissionBudget,
      submissionDate: new Date().toISOString(),
      portalReferenceNumber: submissionRef || undefined,
      notes: submissionNote || undefined,
    });
  };

  const filteredAssignments = activeTab === "all" 
    ? assignments 
    : assignments.filter(a => a.currentStage === activeTab);

  const StageBadge = ({ stage }: { stage: string }) => {
    const config = stageConfig[stage] || stageConfig.assigned;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const PriorityIndicator = ({ priority }: { priority: string }) => {
    const config = priorityConfig[priority] || priorityConfig.normal;
    return (
      <span className={`text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            Bidding Workflow
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage tender assignments and bidding progress
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Assigned
              </CardDescription>
              <CardTitle className="text-3xl">{workflowStats?.assigned || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-blue-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1 text-blue-600">
                <Play className="h-3 w-3" />
                In Progress
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600">{workflowStats?.inProgress || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1 text-amber-600">
                <Eye className="h-3 w-3" />
                Ready for Review
              </CardDescription>
              <CardTitle className="text-3xl text-amber-600">{workflowStats?.readyForReview || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-emerald-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1 text-emerald-600">
                <Send className="h-3 w-3" />
                Submitted
              </CardDescription>
              <CardTitle className="text-3xl text-emerald-600">{workflowStats?.submitted || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Assignments</CardTitle>
            <CardDescription>
              Manage tender assignments and track workflow progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({assignments.length})</TabsTrigger>
                <TabsTrigger value="assigned">Assigned ({workflowStats?.assigned || 0})</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress ({workflowStats?.inProgress || 0})</TabsTrigger>
                <TabsTrigger value="ready_for_review">Review ({workflowStats?.readyForReview || 0})</TabsTrigger>
                <TabsTrigger value="submitted">Submitted ({workflowStats?.submitted || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {filteredAssignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No assignments in this category</p>
                    <p className="text-sm">Assign tenders from the eligible tenders page</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAssignments.map((assignment) => (
                      <Card key={assignment.id} className="hover-elevate" data-testid={`card-assignment-${assignment.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <StageBadge stage={assignment.currentStage || "assigned"} />
                                <PriorityIndicator priority={assignment.priority || "normal"} />
                              </div>
                              <h3 className="font-medium line-clamp-2 mb-1">
                                {assignment.tender?.title || "Unknown Tender"}
                              </h3>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Hash className="h-3 w-3" />
                                  {assignment.tender?.t247Id || "-"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {assignment.tender?.department || assignment.tender?.organization || "-"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {assignment.assignee?.fullName || "Unassigned"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <IndianRupee className="h-3 w-3" />
                                  {formatLakhs(assignment.tender?.estimatedValue)}
                                </span>
                              </div>
                              {assignment.tender?.submissionDeadline && (
                                <div className="flex items-center gap-1 mt-2 text-sm">
                                  <Calendar className="h-3 w-3" />
                                  <span className={
                                    new Date(assignment.tender.submissionDeadline) < new Date() 
                                      ? "text-destructive" 
                                      : "text-muted-foreground"
                                  }>
                                    Deadline: {format(new Date(assignment.tender.submissionDeadline), "MMM d, yyyy")}
                                  </span>
                                  {new Date(assignment.tender.submissionDeadline) < new Date() && (
                                    <Badge variant="destructive" className="ml-2 gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {assignment.currentStage !== "submitted" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStageUpdate(assignment)}
                                    data-testid={`button-update-stage-${assignment.id}`}
                                  >
                                    <ArrowRight className="h-4 w-4 mr-1" />
                                    Update Stage
                                  </Button>
                                  {assignment.currentStage === "ready_for_review" && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleSubmit(assignment)}
                                      data-testid={`button-submit-${assignment.id}`}
                                    >
                                      <Send className="h-4 w-4 mr-1" />
                                      Submit
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Workflow Stage</DialogTitle>
              <DialogDescription>
                Change the current stage for this tender assignment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tender</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedAssignment?.tender?.title}
                </p>
              </div>
              <div className="space-y-2">
                <Label>New Stage</Label>
                <Select value={newStage} onValueChange={setNewStage}>
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Textarea
                  placeholder="Add a note about this stage change..."
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  data-testid="input-stage-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStageDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmStageUpdate}
                disabled={updateStageMutation.isPending}
                data-testid="button-confirm-stage"
              >
                {updateStageMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Update Stage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Tender to Portal</DialogTitle>
              <DialogDescription>
                Record the submission details for this tender
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tender</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedAssignment?.tender?.title}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Submitted Budget (in Lakhs) *</Label>
                <Input
                  type="number"
                  placeholder="e.g., 50"
                  value={submissionBudget}
                  onChange={(e) => setSubmissionBudget(e.target.value)}
                  data-testid="input-budget"
                />
              </div>
              <div className="space-y-2">
                <Label>Portal Reference Number (Optional)</Label>
                <Input
                  placeholder="e.g., GEM/2024/B/1234567"
                  value={submissionRef}
                  onChange={(e) => setSubmissionRef(e.target.value)}
                  data-testid="input-reference"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes about this submission..."
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  data-testid="input-submission-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmSubmission}
                disabled={!submissionBudget || submitMutation.isPending}
                data-testid="button-confirm-submit"
              >
                {submitMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Send className="h-4 w-4 mr-1" />
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
