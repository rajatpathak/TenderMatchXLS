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
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ClipboardList, 
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
  Filter,
  RefreshCw,
  ChevronRight,
  Flag,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { AssignTenderDialog } from "@/components/AssignTenderDialog";
import { Link } from "wouter";
import type { TenderAssignment, Tender, TeamMember } from "@shared/schema";

type AssignmentWithDetails = TenderAssignment & {
  tender?: Tender;
  assignee?: Omit<TeamMember, "password">;
  assigner?: Omit<TeamMember, "password">;
};

const stageConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  assigned: { label: "Assigned", icon: Clock, color: "text-slate-600 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800" },
  in_progress: { label: "In Progress", icon: Play, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900" },
  ready_for_review: { label: "Ready for Review", icon: Eye, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900" },
  submitted: { label: "Submitted", icon: Send, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900" },
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

export default function AssignmentsHub() {
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [tenderToAssign, setTenderToAssign] = useState<Tender | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: assignments = [], isLoading, refetch } = useQuery<AssignmentWithDetails[]>({
    queryKey: ["/api/assignments", activeTab, priorityFilter, assigneeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("stage", activeTab);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (assigneeFilter !== "all") params.set("assignee", assigneeFilter);
      const url = `/api/assignments${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<Omit<TeamMember, "password">[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: currentTeamMember } = useQuery<Omit<TeamMember, "password">>({
    queryKey: ["/api/me/team-member"],
    retry: false,
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

  const { data: eligibleTenders = [] } = useQuery<Tender[]>({
    queryKey: ["/api/tenders/status", "eligible"],
  });

  const assignedTenderIds = new Set(assignments.map(a => a.tenderId));
  const unassignedTenders = eligibleTenders.filter(t => !assignedTenderIds.has(t.id));

  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      const searchLower = searchQuery.toLowerCase();
      const tenderTitle = assignment.tender?.title?.toLowerCase() || "";
      const tenderId = assignment.tender?.t247Id?.toLowerCase() || "";
      return tenderTitle.includes(searchLower) || tenderId.includes(searchLower);
    });
  }, [assignments, searchQuery]);

  const handleAssignTender = (tender: Tender) => {
    setTenderToAssign(tender);
    setAssignDialogOpen(true);
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
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the workflow stage.",
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
        description: "The bid submission has been recorded successfully.",
      });
      setSubmitDialogOpen(false);
      setSelectedAssignment(null);
      setSubmissionBudget("");
      setSubmissionRef("");
      setSubmissionNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to record the bid submission.",
        variant: "destructive",
      });
    },
  });

  const handleQuickStageUpdate = (assignment: AssignmentWithDetails, nextStage: string) => {
    if (!currentTeamMember) {
      toast({
        title: "Error",
        description: "You are not registered as a team member.",
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

  const stageCounts = {
    all: assignments.length,
    assigned: assignments.filter(a => a.currentStage === "assigned").length,
    in_progress: assignments.filter(a => a.currentStage === "in_progress").length,
    ready_for_review: assignments.filter(a => a.currentStage === "ready_for_review").length,
    submitted: assignments.filter(a => a.currentStage === "submitted").length,
  };

  const overdueCount = useMemo(() => {
    return assignments.filter(a => {
      const deadline = a.tender?.submissionDeadline;
      return deadline && isPast(new Date(deadline));
    }).length;
  }, [assignments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Assignments Hub
            </h1>
            <p className="text-muted-foreground mt-1">Manage and track all tender assignments</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {overdueCount > 0 && (
              <Card className="border-red-200 dark:border-red-800 hover-elevate">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Overdue</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{overdueCount}</p>
                    </div>
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className={`hover-elevate ${unassignedTenders.length > 0 ? "border-blue-200 dark:border-blue-800" : ""}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Unassigned</p>
                    <p className={`text-2xl font-bold mt-1 ${unassignedTenders.length > 0 ? "text-blue-600 dark:text-blue-400" : ""}`}>
                      {unassignedTenders.length}
                    </p>
                  </div>
                  <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Assigned</p>
                    <p className="text-2xl font-bold mt-1">{workflowStats?.assigned || 0}</p>
                  </div>
                  <Clock className="w-5 h-5 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">In Progress</p>
                    <p className="text-2xl font-bold mt-1">{workflowStats?.inProgress || 0}</p>
                  </div>
                  <Play className="w-5 h-5 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Ready/Submitted</p>
                    <p className="text-2xl font-bold mt-1">{(workflowStats?.readyForReview || 0) + (workflowStats?.submitted || 0)}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {unassignedTenders.length > 0 && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Ready to Assign
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/tenders/eligible">
                      View All <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {unassignedTenders.slice(0, 3).map((tender) => (
                    <div key={tender.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50" data-testid={`unassigned-tender-${tender.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tender.title}</p>
                        <p className="text-xs text-muted-foreground">{tender.t247Id}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAssignTender(tender)} data-testid={`button-assign-${tender.id}`}>Assign</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="space-y-3">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full justify-start h-auto p-1 bg-muted">
                    <TabsTrigger value="all" className="text-xs" data-testid="tab-all">All ({stageCounts.all})</TabsTrigger>
                    <TabsTrigger value="assigned" className="text-xs" data-testid="tab-assigned">Assigned ({stageCounts.assigned})</TabsTrigger>
                    <TabsTrigger value="in_progress" className="text-xs" data-testid="tab-in-progress">In Progress ({stageCounts.in_progress})</TabsTrigger>
                    <TabsTrigger value="ready_for_review" className="text-xs" data-testid="tab-ready-for-review">Review ({stageCounts.ready_for_review})</TabsTrigger>
                    <TabsTrigger value="submitted" className="text-xs" data-testid="tab-submitted">Submitted ({stageCounts.submitted})</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" data-testid="input-search-assignments" />
                  </div>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-28 h-9" data-testid="filter-priority">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                    <SelectTrigger className="w-32 h-9" data-testid="filter-assignee">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {teamMembers.filter(m => m.isActive).map(member => (
                        <SelectItem key={member.id} value={member.id.toString()}>{member.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh"><RefreshCw className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAssignments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">{searchQuery ? "No matches found" : "No assignments"}</p>
                </div>
              ) : (
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Tender</TableHead>
                      <TableHead className="w-24">Assignee</TableHead>
                      <TableHead className="w-24">Stage</TableHead>
                      <TableHead className="w-16">Priority</TableHead>
                      <TableHead className="w-20">Value</TableHead>
                      <TableHead className="w-24">Deadline</TableHead>
                      <TableHead className="w-16 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => {
                      const nextStage = getNextStage(assignment.currentStage || "assigned");
                      const config = stageConfig[assignment.currentStage || "assigned"];
                      const prioConfig = priorityConfig[assignment.priority || "normal"];
                      const deadline = assignment.tender?.submissionDeadline;
                      const isOverdue = deadline && isPast(new Date(deadline));

                      return (
                        <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                          <TableCell className="font-mono text-xs">{assignment.tender?.t247Id || "-"}</TableCell>
                          <TableCell className="max-w-xs"><span className="truncate block">{assignment.tender?.title || "Unknown"}</span></TableCell>
                          <TableCell className="text-xs">{assignment.assignee?.fullName || "-"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{config?.label}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{prioConfig?.label}</Badge></TableCell>
                          <TableCell className="text-xs">{formatLakhs(assignment.tender?.estimatedValue)}</TableCell>
                          <TableCell className={`text-xs ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                            {deadline ? format(new Date(deadline), "dd MMM") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {nextStage && assignment.currentStage !== "submitted" && (
                              <Button size="xs" variant="ghost" onClick={() => handleQuickStageUpdate(assignment, nextStage)} data-testid={`button-next-stage-${assignment.id}`}>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            )}
                            {assignment.currentStage === "submitted" && <Badge variant="outline" className="text-xs">Done</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{stageConfig[selectedAssignment?.currentStage || "assigned"]?.label}</Badge>
              <ArrowRight className="w-4 h-4" />
              <Badge variant="outline">{stageConfig[newStage]?.label}</Badge>
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder="Add a note..." className="mt-1 text-sm" data-testid="input-stage-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmStageUpdate} disabled={updateStageMutation.isPending} data-testid="button-confirm-stage">
              {updateStageMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="budget">Budget (Lakhs) *</Label>
              <Input id="budget" type="number" step="0.01" value={submissionBudget} onChange={(e) => setSubmissionBudget(e.target.value)} placeholder="Enter budget" className="mt-1 text-sm" data-testid="input-submission-budget" />
            </div>
            <div>
              <Label htmlFor="ref">Portal Reference</Label>
              <Input id="ref" value={submissionRef} onChange={(e) => setSubmissionRef(e.target.value)} placeholder="Portal reference" className="mt-1 text-sm" data-testid="input-submission-ref" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={submissionNote} onChange={(e) => setSubmissionNote(e.target.value)} placeholder="Add notes..." className="mt-1 text-sm" data-testid="input-submission-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSubmission} disabled={!submissionBudget || submitMutation.isPending} data-testid="button-confirm-submission">
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignTenderDialog tender={tenderToAssign} open={assignDialogOpen} onClose={() => { setAssignDialogOpen(false); setTenderToAssign(null); }} />
    </div>
  );
}
