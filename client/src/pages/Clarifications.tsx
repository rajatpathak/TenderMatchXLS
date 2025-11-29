import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Search, 
  Clock,
  CheckCircle,
  XCircle,
  User,
  Send,
  MessageSquare,
  Edit,
  History,
  Loader2,
  ChevronsUpDown,
  Check,
  Trash2,
  HelpCircle,
  FileQuestion,
  Upload,
  File,
} from "lucide-react";
import { format } from "date-fns";
import type { ClarificationWithDetails, TeamMember } from "@shared/schema";

const stageLabels: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  responded: 'Responded',
  closed: 'Closed',
};

const stageOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
];

const getStageIcon = (stage: string) => {
  switch (stage) {
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'submitted':
      return <Send className="w-4 h-4 text-blue-500" />;
    case 'responded':
      return <MessageSquare className="w-4 h-4 text-green-500" />;
    case 'closed':
      return <CheckCircle className="w-4 h-4 text-gray-500" />;
    default:
      return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
  }
};

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'submitted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'responded':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'closed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

interface TenderReference {
  referenceId: string;
  title?: string;
  tenderId?: number;
}

interface DepartmentContact {
  name?: string;
  phone?: string;
  email?: string;
}

function StageTimeline({ history }: { history: ClarificationWithDetails['history'] }) {
  if (!history || history.length === 0) {
    return <p className="text-sm text-muted-foreground">No history available</p>;
  }

  const sortedHistory = [...history].sort((a, b) => 
    new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />
      <div className="space-y-4">
        {sortedHistory.map((entry, index) => (
          <div key={entry.id} className="relative flex gap-3">
            <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full ${
              index === sortedHistory.length - 1 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted border border-border'
            }`}>
              {getStageIcon(entry.toStage || '')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {entry.fromStage && (
                  <>
                    <Badge variant="outline" className="text-muted-foreground">
                      {stageLabels[entry.fromStage] || entry.fromStage}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <Badge className={`${getStageColor(entry.toStage || '')}`}>
                  {stageLabels[entry.toStage || ''] || entry.toStage}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {entry.timestamp ? format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a') : 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                by {entry.changedByMember?.fullName || 'Unknown'}
              </p>
              {entry.note && (
                <p className="text-sm mt-1 text-foreground/80">{entry.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClarificationsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedClarification, setSelectedClarification] = useState<ClarificationWithDetails | null>(null);
  
  const [referenceSearchOpen, setReferenceSearchOpen] = useState(false);
  const [referenceSearchQuery, setReferenceSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    referenceId: "",
    tenderId: null as number | null,
    clarificationDetails: "",
    assignedTo: 0,
    submitDeadlineDate: "",
    submitDeadlineTime: "",
    departmentContacts: [{ name: "", phone: "", email: "" }] as DepartmentContact[],
    notes: "",
    responseDetails: "",
  });

  const [newStage, setNewStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const { data: clarifications, isLoading } = useQuery<ClarificationWithDetails[]>({
    queryKey: ['/api/clarifications'],
  });

  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-members'],
  });

  const { data: tenderReferences, isLoading: isSearching } = useQuery<TenderReference[]>({
    queryKey: ['/api/tender-references/search', referenceSearchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/tender-references/search?q=${encodeURIComponent(referenceSearchQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: referenceSearchQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/clarifications', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clarifications'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Clarification created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create clarification", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const res = await apiRequest('PATCH', `/api/clarifications/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clarifications'] });
      setIsEditDialogOpen(false);
      resetForm();
      toast({ title: "Clarification updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update clarification", description: error.message, variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage, note }: { id: number; stage: string; note?: string }) => {
      const res = await apiRequest('PATCH', `/api/clarifications/${id}/stage`, { stage, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clarifications'] });
      setIsStageDialogOpen(false);
      setNewStage("");
      setStageNote("");
      toast({ title: "Stage updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update stage", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/clarifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clarifications'] });
      toast({ title: "Clarification deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete clarification", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      referenceId: "",
      tenderId: null,
      clarificationDetails: "",
      assignedTo: 0,
      submitDeadlineDate: "",
      submitDeadlineTime: "",
      departmentContacts: [{ name: "", phone: "", email: "" }],
      notes: "",
      responseDetails: "",
    });
    setReferenceSearchQuery("");
  };

  const handleEdit = (clarification: ClarificationWithDetails) => {
    setSelectedClarification(clarification);
    setFormData({
      referenceId: clarification.referenceId,
      tenderId: clarification.tenderId,
      clarificationDetails: clarification.clarificationDetails,
      assignedTo: clarification.assignedTo,
      submitDeadlineDate: clarification.submitDeadlineDate 
        ? new Date(clarification.submitDeadlineDate).toISOString().split('T')[0] 
        : "",
      submitDeadlineTime: clarification.submitDeadlineTime || "",
      departmentContacts: (clarification.departmentContacts as DepartmentContact[]) || [{ name: "", phone: "", email: "" }],
      notes: clarification.notes || "",
      responseDetails: clarification.responseDetails || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleStageChange = (clarification: ClarificationWithDetails) => {
    setSelectedClarification(clarification);
    setNewStage(clarification.currentStage || 'pending');
    setStageNote("");
    setSubmissionFile(null);
    setIsStageDialogOpen(true);
  };

  const handleStageSubmit = async () => {
    if (!selectedClarification || !newStage) return;
    
    try {
      if (newStage === 'submitted' && submissionFile) {
        setIsUploadingFile(true);
        const formData = new FormData();
        formData.append('file', submissionFile);
        formData.append('stage', newStage);
        formData.append('note', stageNote || '');
        
        const response = await fetch(`/api/clarifications/${selectedClarification.id}/submit`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to submit clarification');
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/clarifications'] });
        setIsStageDialogOpen(false);
        setNewStage("");
        setStageNote("");
        setSubmissionFile(null);
        toast({ title: "Clarification submitted successfully" });
      } else {
        updateStageMutation.mutate({
          id: selectedClarification.id,
          stage: newStage,
          note: stageNote || undefined,
        });
      }
    } catch (error) {
      toast({ title: "Failed to submit clarification", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleViewHistory = (clarification: ClarificationWithDetails) => {
    setSelectedClarification(clarification);
    setIsHistoryDialogOpen(true);
  };

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      departmentContacts: [...prev.departmentContacts, { name: "", phone: "", email: "" }]
    }));
  };

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      departmentContacts: prev.departmentContacts.filter((_, i) => i !== index)
    }));
  };

  const updateContact = (index: number, field: keyof DepartmentContact, value: string) => {
    setFormData(prev => ({
      ...prev,
      departmentContacts: prev.departmentContacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const filteredClarifications = useMemo(() => {
    if (!clarifications) return [];
    
    return clarifications.filter(c => {
      const matchesSearch = searchQuery === "" || 
        c.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tender?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clarificationDetails.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.assignee?.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStage = stageFilter === "all" || c.currentStage === stageFilter;
      
      return matchesSearch && matchesStage;
    });
  }, [clarifications, searchQuery, stageFilter]);

  const stats = useMemo(() => {
    if (!clarifications) return { pending: 0, submitted: 0, responded: 0, closed: 0 };
    
    return {
      pending: clarifications.filter(c => c.currentStage === 'pending').length,
      submitted: clarifications.filter(c => c.currentStage === 'submitted').length,
      responded: clarifications.filter(c => c.currentStage === 'responded').length,
      closed: clarifications.filter(c => c.currentStage === 'closed').length,
    };
  }, [clarifications]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Clarifications</h1>
            <p className="text-muted-foreground">Track tender clarification requests and responses</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-clarification">
                <Plus className="w-4 h-4 mr-2" />
                New Clarification
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Clarification Request</DialogTitle>
                <DialogDescription>
                  Track a clarification request for a tender
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tender ID</Label>
                  <Popover open={referenceSearchOpen} onOpenChange={setReferenceSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        data-testid="button-select-tender"
                      >
                        {formData.referenceId || "Search and select a tender..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search by Tender ID or title..." 
                          value={referenceSearchQuery}
                          onValueChange={setReferenceSearchQuery}
                          data-testid="input-search-tender"
                        />
                        <CommandList>
                          {referenceSearchQuery.length < 2 ? (
                            <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
                          ) : isSearching ? (
                            <CommandEmpty>
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Searching...</span>
                              </div>
                            </CommandEmpty>
                          ) : !tenderReferences || tenderReferences.length === 0 ? (
                            <CommandEmpty>No matching tenders found.</CommandEmpty>
                          ) : (
                            <CommandGroup heading="Matching Tenders">
                              {tenderReferences.map((ref) => (
                                <CommandItem
                                  key={ref.referenceId}
                                  value={ref.referenceId}
                                  onSelect={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      referenceId: ref.referenceId,
                                      tenderId: ref.tenderId || null,
                                    }));
                                    setReferenceSearchQuery("");
                                    setReferenceSearchOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      formData.referenceId === ref.referenceId ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{ref.referenceId}</p>
                                    {ref.title && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {ref.title}
                                      </p>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Or enter manually:
                    <Input
                      placeholder="Enter Tender ID manually"
                      value={formData.referenceId}
                      onChange={(e) => setFormData(prev => ({ ...prev, referenceId: e.target.value }))}
                      className="mt-1"
                      data-testid="input-tender-id-manual"
                    />
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Clarification Details</Label>
                  <Textarea
                    placeholder="Describe the clarification needed..."
                    value={formData.clarificationDetails}
                    onChange={(e) => setFormData(prev => ({ ...prev, clarificationDetails: e.target.value }))}
                    rows={4}
                    data-testid="textarea-clarification-details"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select
                    value={formData.assignedTo.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: parseInt(value) }))}
                  >
                    <SelectTrigger data-testid="select-assignee">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers?.map((member) => (
                        <SelectItem key={member.id} value={member.id.toString()}>
                          {member.fullName} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Submit Deadline</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        type="date"
                        value={formData.submitDeadlineDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitDeadlineDate: e.target.value }))}
                        data-testid="input-submit-deadline-date"
                      />
                    </div>
                    <div>
                      <Input
                        type="time"
                        value={formData.submitDeadlineTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitDeadlineTime: e.target.value }))}
                        data-testid="input-submit-deadline-time"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When must this clarification be submitted? Used for reminder notifications.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Department Contacts</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={addContact}
                      data-testid="button-add-contact"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Contact
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {formData.departmentContacts.map((contact, index) => (
                      <div key={index} className="p-3 border rounded-md space-y-2 relative">
                        {formData.departmentContacts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={() => removeContact(index)}
                            data-testid={`button-remove-contact-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Name"
                            value={contact.name || ""}
                            onChange={(e) => updateContact(index, 'name', e.target.value)}
                            data-testid={`input-contact-name-${index}`}
                          />
                          <Input
                            placeholder="Phone"
                            value={contact.phone || ""}
                            onChange={(e) => updateContact(index, 'phone', e.target.value)}
                            data-testid={`input-contact-phone-${index}`}
                          />
                          <Input
                            placeholder="Email"
                            type="email"
                            value={contact.email || ""}
                            onChange={(e) => updateContact(index, 'email', e.target.value)}
                            data-testid={`input-contact-email-${index}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any additional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    data-testid="textarea-notes"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.referenceId || !formData.clarificationDetails || !formData.assignedTo || createMutation.isPending}
                  data-testid="button-submit-add"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Clarification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover-elevate" onClick={() => setStageFilter("pending")} data-testid="card-stat-pending">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setStageFilter("submitted")} data-testid="card-stat-submitted">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="text-2xl font-bold">{stats.submitted}</p>
                </div>
                <Send className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setStageFilter("responded")} data-testid="card-stat-responded">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Responded</p>
                  <p className="text-2xl font-bold">{stats.responded}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setStageFilter("closed")} data-testid="card-stat-closed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closed</p>
                  <p className="text-2xl font-bold">{stats.closed}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>All Clarifications</CardTitle>
                <CardDescription>Track and manage clarification requests</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Tender ID, title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-clarifications"
                  />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-40" data-testid="select-stage-filter">
                    <SelectValue placeholder="Filter by stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {stageOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClarifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileQuestion className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No clarifications found</p>
                <p className="text-sm">Create a new clarification request to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tender ID</TableHead>
                    <TableHead>Clarification</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClarifications.map((clarification) => (
                    <TableRow key={clarification.id} data-testid={`row-clarification-${clarification.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{clarification.referenceId}</span>
                          {clarification.tender?.title && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                              {clarification.tender.title}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm line-clamp-2 max-w-[300px]">
                          {clarification.clarificationDetails}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{clarification.assignee?.fullName || 'Unassigned'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`${getStageColor(clarification.currentStage || 'pending')} cursor-pointer`}
                          onClick={() => handleStageChange(clarification)}
                          data-testid={`badge-stage-${clarification.id}`}
                        >
                          {getStageIcon(clarification.currentStage || 'pending')}
                          <span className="ml-1">{stageLabels[clarification.currentStage || 'pending']}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {clarification.createdAt ? format(new Date(clarification.createdAt), 'MMM d, yyyy') : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(clarification)}
                            data-testid={`button-edit-${clarification.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewHistory(clarification)}
                            data-testid={`button-history-${clarification.id}`}
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this clarification?')) {
                                deleteMutation.mutate(clarification.id);
                              }
                            }}
                            data-testid={`button-delete-${clarification.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isStageDialogOpen} onOpenChange={(open) => {
          setIsStageDialogOpen(open);
          if (!open) {
            setSubmissionFile(null);
            setStageNote("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Clarification Stage</DialogTitle>
              <DialogDescription>
                Change the stage of this clarification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Stage</Label>
                <Select value={newStage} onValueChange={(value) => {
                  setNewStage(value);
                  if (value !== 'submitted') {
                    setSubmissionFile(null);
                  }
                }}>
                  <SelectTrigger data-testid="select-new-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {newStage === 'submitted' && (
                <div className="space-y-2">
                  <Label>Submission Document</Label>
                  <div className="border-2 border-dashed rounded-md p-4 text-center">
                    {submissionFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm">{submissionFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSubmissionFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Click to upload submission document
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF, DOC, DOCX accepted
                          </span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                          data-testid="input-submission-file"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload the document you submitted for this clarification
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="Add a note about this stage change..."
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  data-testid="textarea-stage-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleStageSubmit}
                disabled={!newStage || updateStageMutation.isPending || isUploadingFile}
                data-testid="button-submit-stage"
              >
                {(updateStageMutation.isPending || isUploadingFile) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {newStage === 'submitted' ? 'Submit Clarification' : 'Update Stage'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Clarification History</DialogTitle>
              <DialogDescription>
                {selectedClarification?.referenceId}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="p-4">
                {selectedClarification && (
                  <StageTimeline history={selectedClarification.history} />
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Clarification</DialogTitle>
              <DialogDescription>
                Update clarification details
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tender ID</Label>
                <Input
                  value={formData.referenceId}
                  onChange={(e) => setFormData(prev => ({ ...prev, referenceId: e.target.value }))}
                  data-testid="input-edit-tender-id"
                />
              </div>

              <div className="space-y-2">
                <Label>Clarification Details</Label>
                <Textarea
                  placeholder="Describe the clarification needed..."
                  value={formData.clarificationDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, clarificationDetails: e.target.value }))}
                  rows={4}
                  data-testid="textarea-edit-clarification-details"
                />
              </div>

              <div className="space-y-2">
                <Label>Response Details</Label>
                <Textarea
                  placeholder="Enter the response received..."
                  value={formData.responseDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, responseDetails: e.target.value }))}
                  rows={4}
                  data-testid="textarea-edit-response-details"
                />
              </div>

              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={formData.assignedTo.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: parseInt(value) }))}
                >
                  <SelectTrigger data-testid="select-edit-assignee">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers?.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        {member.fullName} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Submit Deadline</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="date"
                      value={formData.submitDeadlineDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, submitDeadlineDate: e.target.value }))}
                      data-testid="input-edit-submit-deadline-date"
                    />
                  </div>
                  <div>
                    <Input
                      type="time"
                      value={formData.submitDeadlineTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, submitDeadlineTime: e.target.value }))}
                      data-testid="input-edit-submit-deadline-time"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  When must this clarification be submitted? Used for reminder notifications.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Department Contacts</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addContact}
                    data-testid="button-edit-add-contact"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Contact
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.departmentContacts.map((contact, index) => (
                    <div key={index} className="p-3 border rounded-md space-y-2 relative">
                      {formData.departmentContacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => removeContact(index)}
                          data-testid={`button-edit-remove-contact-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Name"
                          value={contact.name || ""}
                          onChange={(e) => updateContact(index, 'name', e.target.value)}
                          data-testid={`input-edit-contact-name-${index}`}
                        />
                        <Input
                          placeholder="Phone"
                          value={contact.phone || ""}
                          onChange={(e) => updateContact(index, 'phone', e.target.value)}
                          data-testid={`input-edit-contact-phone-${index}`}
                        />
                        <Input
                          placeholder="Email"
                          type="email"
                          value={contact.email || ""}
                          onChange={(e) => updateContact(index, 'email', e.target.value)}
                          data-testid={`input-edit-contact-email-${index}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  data-testid="textarea-edit-notes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => selectedClarification && updateMutation.mutate({
                  id: selectedClarification.id,
                  data: formData,
                })}
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
