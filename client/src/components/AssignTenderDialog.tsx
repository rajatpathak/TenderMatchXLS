import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CalendarIcon, 
  User, 
  Flag, 
  IndianRupee,
  Building2,
  Hash,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tender, TeamMember } from "@shared/schema";

interface AssignTenderDialogProps {
  tender: Tender | null;
  open: boolean;
  onClose: () => void;
  selfAssign?: boolean;
}

const priorityOptions = [
  { value: "low", label: "Low", color: "text-slate-500" },
  { value: "normal", label: "Normal", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

function formatLakhs(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `${(num / 100000).toFixed(2)} L`;
  }
  return `${num.toLocaleString("en-IN")}`;
}

export function AssignTenderDialog({ tender, open, onClose, selfAssign = false }: AssignTenderDialogProps) {
  const { toast } = useToast();
  const [selectedBidder, setSelectedBidder] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [internalDeadline, setInternalDeadline] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");

  const { data: teamMembers = [] } = useQuery<Omit<TeamMember, "password">[]>({
    queryKey: ["/api/team-members"],
    enabled: open && !selfAssign,
  });

  const { data: currentTeamMember } = useQuery<Omit<TeamMember, "password">>({
    queryKey: ["/api/me/team-member"],
    enabled: open,
  });

  const { data: existingAssignments = [] } = useQuery<{ tenderId: number; assignedTo: number }[]>({
    queryKey: ["/api/assignments"],
    enabled: open,
    select: (data: any[]) => data.map(a => ({ tenderId: a.tenderId, assignedTo: a.assignedTo })),
  });

  const bidders = teamMembers.filter(m => m.role === "bidder" || m.role === "manager");
  
  const isAlreadyAssigned = tender ? existingAssignments.some(a => a.tenderId === tender.id) : false;

  const assignMutation = useMutation({
    mutationFn: async (data: {
      tenderId: number;
      assignedTo: number;
      assignedBy: number;
      priority: string;
      internalDeadline?: string;
      notes?: string;
    }) => {
      return apiRequest("POST", "/api/assignments", data);
    },
    onSuccess: () => {
      toast({
        title: selfAssign ? "Tender Claimed" : "Tender Assigned",
        description: selfAssign 
          ? "You have successfully claimed this tender."
          : "The tender has been assigned successfully.",
      });
      resetForm();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/unassigned"] });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign the tender.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedBidder("");
    setPriority("normal");
    setInternalDeadline(undefined);
    setNotes("");
  };

  const handleAssign = () => {
    if (!tender || !currentTeamMember) return;

    const assigneeId = selfAssign ? currentTeamMember.id : parseInt(selectedBidder);
    
    if (!assigneeId) {
      toast({
        title: "Select a Bidder",
        description: "Please select a team member to assign this tender to.",
        variant: "destructive",
      });
      return;
    }

    assignMutation.mutate({
      tenderId: tender.id,
      assignedTo: assigneeId,
      assignedBy: currentTeamMember.id,
      priority,
      internalDeadline: internalDeadline?.toISOString(),
      notes: notes || undefined,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!tender) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {selfAssign ? "Claim Tender" : "Assign Tender"}
          </DialogTitle>
          <DialogDescription>
            {selfAssign 
              ? "Take ownership of this tender and add it to your work queue."
              : "Assign this tender to a team member for bidding."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono">{tender.t247Id}</span>
            </div>
            <h4 className="font-medium text-sm line-clamp-2">{tender.title}</h4>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <IndianRupee className="w-3 h-3" />
                {formatLakhs(tender.estimatedValue)}
              </span>
              {tender.department && (
                <span className="flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3" />
                  {tender.department.slice(0, 20)}...
                </span>
              )}
            </div>
            {tender.submissionDeadline && (
              <div className="text-xs text-muted-foreground">
                Deadline: {format(new Date(tender.submissionDeadline), "dd MMM yyyy")}
              </div>
            )}
          </div>

          {isAlreadyAssigned && (
            <div className="p-3 bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This tender is already assigned to a team member.
              </p>
            </div>
          )}

          {!selfAssign && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Assign To *
              </Label>
              <Select value={selectedBidder} onValueChange={setSelectedBidder}>
                <SelectTrigger data-testid="select-bidder">
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {bidders.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No bidders available. Add team members first.
                    </div>
                  ) : (
                    bidders.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{member.fullName}</span>
                          <Badge variant="outline" className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {selfAssign && currentTeamMember && (
            <div className="p-3 bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                This tender will be assigned to you: <strong>{currentTeamMember.fullName}</strong>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Priority
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className={option.color}>{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Internal Deadline (Optional)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !internalDeadline && "text-muted-foreground"
                  )}
                  data-testid="button-internal-deadline"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {internalDeadline ? format(internalDeadline, "PPP") : "Set internal deadline"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={internalDeadline}
                  onSelect={setInternalDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this assignment..."
              className="resize-none"
              rows={3}
              data-testid="input-assignment-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignMutation.isPending || isAlreadyAssigned || (!selfAssign && !selectedBidder)}
            data-testid="button-confirm-assign"
          >
            {assignMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {selfAssign ? "Claim Tender" : "Assign Tender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
