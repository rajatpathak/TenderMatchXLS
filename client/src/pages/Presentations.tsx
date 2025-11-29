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
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Mail,
  Upload,
  Edit,
  History,
  Loader2,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Trash2,
  FileText,
  Presentation,
} from "lucide-react";
import { format } from "date-fns";
import type { PresentationWithDetails, TeamMember } from "@shared/schema";

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusOptions = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'scheduled':
      return <Calendar className="w-4 h-4 text-blue-500" />;
    case 'in_progress':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
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

function StatusTimeline({ history }: { history: PresentationWithDetails['history'] }) {
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
              {entry.action === 'file_uploaded' ? <Upload className="w-3 h-3" /> : getStatusIcon(entry.newStatus || '')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {entry.action === 'file_uploaded' ? (
                  <Badge variant="outline">File Uploaded</Badge>
                ) : (
                  <Badge className={`${getStatusColor(entry.newStatus || '')}`}>
                    {statusLabels[entry.newStatus || ''] || entry.newStatus || entry.action}
                  </Badge>
                )}
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

export default function PresentationsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedPresentation, setSelectedPresentation] = useState<PresentationWithDetails | null>(null);
  
  const [referenceSearchOpen, setReferenceSearchOpen] = useState(false);
  const [referenceSearchQuery, setReferenceSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    referenceId: "",
    tenderId: null as number | null,
    scheduledDate: "",
    scheduledTime: "",
    assignedTo: 0,
    departmentContacts: [{ name: "", phone: "", email: "" }] as DepartmentContact[],
    notes: "",
  });
  
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const { data: presentations, isLoading } = useQuery<PresentationWithDetails[]>({
    queryKey: ['/api/presentations'],
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
    mutationFn: async ({ data, file }: { data: typeof formData; file: File | null }) => {
      const formDataObj = new FormData();
      formDataObj.append('referenceId', data.referenceId);
      if (data.tenderId) formDataObj.append('tenderId', data.tenderId.toString());
      formDataObj.append('scheduledDate', data.scheduledDate);
      formDataObj.append('scheduledTime', data.scheduledTime);
      formDataObj.append('assignedTo', data.assignedTo.toString());
      formDataObj.append('departmentContacts', JSON.stringify(data.departmentContacts));
      if (data.notes) formDataObj.append('notes', data.notes);
      if (file) formDataObj.append('document', file);
      
      const res = await fetch('/api/presentations', {
        method: 'POST',
        body: formDataObj,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create presentation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Presentation scheduled successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to schedule presentation", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const res = await apiRequest('PATCH', `/api/presentations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setIsEditDialogOpen(false);
      resetForm();
      toast({ title: "Presentation updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update presentation", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: string; note?: string }) => {
      const res = await apiRequest('PATCH', `/api/presentations/${id}/status`, { status, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setIsStatusDialogOpen(false);
      setNewStatus("");
      setStatusNote("");
      toast({ title: "Status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/presentations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      toast({ title: "Presentation deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete presentation", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      referenceId: "",
      tenderId: null,
      scheduledDate: "",
      scheduledTime: "",
      assignedTo: 0,
      departmentContacts: [{ name: "", phone: "", email: "" }],
      notes: "",
    });
    setDocumentFile(null);
    setReferenceSearchQuery("");
  };

  const handleEdit = (presentation: PresentationWithDetails) => {
    setSelectedPresentation(presentation);
    setFormData({
      referenceId: presentation.referenceId,
      tenderId: presentation.tenderId,
      scheduledDate: presentation.scheduledDate ? format(new Date(presentation.scheduledDate), 'yyyy-MM-dd') : "",
      scheduledTime: presentation.scheduledTime || "",
      assignedTo: presentation.assignedTo,
      departmentContacts: (presentation.departmentContacts as DepartmentContact[]) || [{ name: "", phone: "", email: "" }],
      notes: presentation.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleStatusChange = (presentation: PresentationWithDetails) => {
    setSelectedPresentation(presentation);
    setNewStatus(presentation.status || 'scheduled');
    setIsStatusDialogOpen(true);
  };

  const handleViewHistory = (presentation: PresentationWithDetails) => {
    setSelectedPresentation(presentation);
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

  const filteredPresentations = useMemo(() => {
    if (!presentations) return [];
    
    return presentations.filter(p => {
      const matchesSearch = searchQuery === "" || 
        p.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tender?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.assignee?.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [presentations, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    if (!presentations) return { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };
    
    return {
      scheduled: presentations.filter(p => p.status === 'scheduled').length,
      in_progress: presentations.filter(p => p.status === 'in_progress').length,
      completed: presentations.filter(p => p.status === 'completed').length,
      cancelled: presentations.filter(p => p.status === 'cancelled').length,
    };
  }, [presentations]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Presentations</h1>
            <p className="text-muted-foreground">Schedule and track tender presentations</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-presentation">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Presentation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Presentation</DialogTitle>
                <DialogDescription>
                  Schedule a presentation for a tender with department contacts
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scheduled Date</Label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                      data-testid="input-scheduled-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scheduled Time</Label>
                    <Input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      data-testid="input-scheduled-time"
                    />
                  </div>
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

                <div className="space-y-2">
                  <Label>Attach Document (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                      data-testid="input-document-file"
                      className="flex-1"
                    />
                    {documentFile && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{documentFile.name}</span>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setDocumentFile(null)}
                          data-testid="button-remove-document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Supported: PDF, Word, Images (JPG, PNG, GIF)</p>
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
                  onClick={() => createMutation.mutate({ data: formData, file: documentFile })}
                  disabled={!formData.referenceId || !formData.scheduledDate || !formData.scheduledTime || !formData.assignedTo || createMutation.isPending}
                  data-testid="button-submit-add"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Schedule Presentation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("scheduled")} data-testid="card-stat-scheduled">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold">{stats.scheduled}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("in_progress")} data-testid="card-stat-in-progress">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats.in_progress}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("completed")} data-testid="card-stat-completed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("cancelled")} data-testid="card-stat-cancelled">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                  <p className="text-2xl font-bold">{stats.cancelled}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>All Presentations</CardTitle>
                <CardDescription>Manage scheduled presentations</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Tender ID, title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-presentations"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map((opt) => (
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
            ) : filteredPresentations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Presentation className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No presentations found</p>
                <p className="text-sm">Schedule a new presentation to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tender ID</TableHead>
                    <TableHead>Scheduled Date/Time</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPresentations.map((presentation) => (
                    <TableRow key={presentation.id} data-testid={`row-presentation-${presentation.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{presentation.referenceId}</span>
                          {presentation.tender?.title && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                              {presentation.tender.title}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p>{presentation.scheduledDate ? format(new Date(presentation.scheduledDate), 'MMM d, yyyy') : '-'}</p>
                            <p className="text-xs text-muted-foreground">{presentation.scheduledTime || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{presentation.assignee?.fullName || 'Unassigned'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(presentation.departmentContacts as DepartmentContact[])?.length > 0 ? (
                          <div className="space-y-1">
                            {(presentation.departmentContacts as DepartmentContact[]).slice(0, 2).map((contact, idx) => (
                              <div key={idx} className="text-xs">
                                {contact.name && <span>{contact.name}</span>}
                                {contact.phone && (
                                  <span className="text-muted-foreground ml-2">{contact.phone}</span>
                                )}
                              </div>
                            ))}
                            {(presentation.departmentContacts as DepartmentContact[]).length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{(presentation.departmentContacts as DepartmentContact[]).length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`${getStatusColor(presentation.status || 'scheduled')} cursor-pointer`}
                          onClick={() => handleStatusChange(presentation)}
                          data-testid={`badge-status-${presentation.id}`}
                        >
                          {getStatusIcon(presentation.status || 'scheduled')}
                          <span className="ml-1">{statusLabels[presentation.status || 'scheduled']}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(presentation)}
                            data-testid={`button-edit-${presentation.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewHistory(presentation)}
                            data-testid={`button-history-${presentation.id}`}
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this presentation?')) {
                                deleteMutation.mutate(presentation.id);
                              }
                            }}
                            data-testid={`button-delete-${presentation.id}`}
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

        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Presentation Status</DialogTitle>
              <DialogDescription>
                Change the status of this presentation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="Add a note about this status change..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  data-testid="textarea-status-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => selectedPresentation && updateStatusMutation.mutate({
                  id: selectedPresentation.id,
                  status: newStatus,
                  note: statusNote || undefined,
                })}
                disabled={!newStatus || updateStatusMutation.isPending}
                data-testid="button-submit-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Presentation History</DialogTitle>
              <DialogDescription>
                {selectedPresentation?.referenceId}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="p-4">
                {selectedPresentation && (
                  <StatusTimeline history={selectedPresentation.history} />
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
              <DialogTitle>Edit Presentation</DialogTitle>
              <DialogDescription>
                Update presentation details
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    data-testid="input-edit-scheduled-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Time</Label>
                  <Input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    data-testid="input-edit-scheduled-time"
                  />
                </div>
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
                onClick={() => selectedPresentation && updateMutation.mutate({
                  id: selectedPresentation.id,
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
