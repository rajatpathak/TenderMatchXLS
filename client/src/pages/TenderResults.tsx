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
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ban,
  Edit,
  History,
  Loader2,
  ChevronRight,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react";
import { format } from "date-fns";
import type { 
  TenderResultWithHistory, 
  TenderResultStatus,
  tenderResultStatusLabels,
} from "@shared/schema";

const statusLabels: Record<string, string> = {
  technically_qualified: 'Technically Qualified',
  technically_rejected: 'Technically Rejected',
  l1: 'L1',
  financially_rejected: 'Financially Rejected',
  cancelled: 'Cancelled',
  awarded: 'Awarded',
};

const statusOptions = [
  { value: 'technically_qualified', label: 'Technically Qualified' },
  { value: 'technically_rejected', label: 'Technically Rejected' },
  { value: 'l1', label: 'L1' },
  { value: 'financially_rejected', label: 'Financially Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'awarded', label: 'Awarded' },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'technically_qualified':
      return <CheckCircle className="w-4 h-4 text-blue-500" />;
    case 'technically_rejected':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'l1':
      return <Trophy className="w-4 h-4 text-yellow-500" />;
    case 'financially_rejected':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'cancelled':
      return <Ban className="w-4 h-4 text-gray-500" />;
    case 'awarded':
      return <Trophy className="w-4 h-4 text-green-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'technically_qualified':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'technically_rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'l1':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'financially_rejected':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300';
    case 'awarded':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

interface TenderReference {
  referenceId: string;
  title?: string;
  tenderId?: number;
}

function StatusTimeline({ history }: { history: TenderResultWithHistory['history'] }) {
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
              {getStatusIcon(entry.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusColor(entry.status)}`}>
                  {statusLabels[entry.status] || entry.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {entry.timestamp ? format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a') : 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                by {entry.updatedByMember?.fullName || 'Unknown'}
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

function AddResultDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedReference, setSelectedReference] = useState<TenderReference | null>(null);
  const [status, setStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: searchResults = [], isLoading: isSearching } = useQuery<TenderReference[]>({
    queryKey: ['/api/tender-references/search', searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/tender-references/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search');
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  useEffect(() => {
    if (!open) {
      setSelectedReference(null);
      setStatus("");
      setSearchQuery("");
      setPopoverOpen(false);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async (data: { referenceId: string; status: string; tenderId?: number }) => {
      return apiRequest("POST", "/api/tender-results", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tender-results'] });
      toast({ title: "Tender result created successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating tender result", 
        description: error?.message || "Something went wrong",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedReference) {
      toast({ title: "Please select a Reference ID from the list", variant: "destructive" });
      return;
    }
    if (!status) {
      toast({ title: "Please select a status", variant: "destructive" });
      return;
    }
    createMutation.mutate({ 
      referenceId: selectedReference.referenceId, 
      status, 
      tenderId: selectedReference.tenderId || undefined 
    });
  };

  const handleSelectReference = (ref: TenderReference) => {
    setSelectedReference(ref);
    setSearchQuery("");
    setPopoverOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedReference(null);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Tender Result</DialogTitle>
          <DialogDescription>
            Select a tender from the system and record its result status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tender ID</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between"
                  data-testid="button-select-reference"
                >
                  {selectedReference ? (
                    <span className="truncate">{selectedReference.referenceId}</span>
                  ) : (
                    <span className="text-muted-foreground">Search and select a Tender ID...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Type to search Tender IDs..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    data-testid="input-search-reference"
                  />
                  <CommandList>
                    {searchQuery.length < 2 ? (
                      <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
                    ) : isSearching ? (
                      <CommandEmpty>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Searching...</span>
                        </div>
                      </CommandEmpty>
                    ) : searchResults.length === 0 ? (
                      <CommandEmpty>No matching tenders found.</CommandEmpty>
                    ) : (
                      <CommandGroup heading="Matching Tenders">
                        {searchResults.map((ref) => (
                          <CommandItem
                            key={ref.referenceId}
                            value={ref.referenceId}
                            onSelect={() => handleSelectReference(ref)}
                            className="cursor-pointer"
                            data-testid={`option-reference-${ref.referenceId}`}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedReference?.referenceId === ref.referenceId 
                                  ? "opacity-100" 
                                  : "opacity-0"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{ref.referenceId}</p>
                              {ref.title && (
                                <p className="text-xs text-muted-foreground truncate">{ref.title}</p>
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
            {selectedReference && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{selectedReference.referenceId}</span>
                  {selectedReference.tenderId && (
                    <span className="text-muted-foreground"> (ID: {selectedReference.tenderId})</span>
                  )}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5"
                  onClick={handleClearSelection}
                  data-testid="button-clear-reference"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Select Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(opt.value)}
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createMutation.isPending || !selectedReference}
            data-testid="button-save-result"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateStatusDialog({ 
  result, 
  open, 
  onOpenChange 
}: { 
  result: TenderResultWithHistory;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState(result.currentStatus);
  const [note, setNote] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (data: { status: string; note?: string }) => {
      return apiRequest("PATCH", `/api/tender-results/${result.id}/status`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tender-results'] });
      toast({ title: "Status updated successfully" });
      onOpenChange(false);
      setNote("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating status", 
        description: error?.message || "Something went wrong",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = () => {
    if (!status) {
      toast({ title: "Please select a status", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ status, note: note || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          <DialogDescription>
            Update the status for tender {result.referenceId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Status</Label>
            <Badge className={getStatusColor(result.currentStatus)}>
              {statusLabels[result.currentStatus] || result.currentStatus}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-status">New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="new-status" data-testid="select-new-status">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(opt.value)}
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a note about this status change..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
              data-testid="input-note"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateMutation.isPending || status === result.currentStatus}
            data-testid="button-update-status"
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ 
  result, 
  open, 
  onOpenChange 
}: { 
  result: TenderResultWithHistory;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Status History</DialogTitle>
          <DialogDescription>
            Complete history for tender {result.referenceId}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="py-4">
            <StatusTimeline history={result.history} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function TenderResults() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [updateDialogResult, setUpdateDialogResult] = useState<TenderResultWithHistory | null>(null);
  const [historyDialogResult, setHistoryDialogResult] = useState<TenderResultWithHistory | null>(null);

  const { data: results = [], isLoading } = useQuery<TenderResultWithHistory[]>({
    queryKey: ['/api/tender-results'],
  });

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      const matchesSearch = searchQuery === "" || 
        result.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.tender?.title?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || result.currentStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [results, searchQuery, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: results.length };
    results.forEach((r) => {
      counts[r.currentStatus] = (counts[r.currentStatus] || 0) + 1;
    });
    return counts;
  }, [results]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Tender Results</h1>
            <p className="text-muted-foreground">Track and manage tender result statuses</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-new">
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by Reference ID or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({statusCounts.all || 0})</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(opt.value)}
                    <span>{opt.label} ({statusCounts[opt.value] || 0})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Results List</CardTitle>
            <CardDescription>
              {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'} found
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tender results found</p>
                <p className="text-sm mt-1">Click "Add New" to create your first entry</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference ID</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead>Last Updated By</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((result) => (
                    <TableRow key={result.id} data-testid={`row-result-${result.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{result.referenceId}</p>
                          {result.tender?.title && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {result.tender.title}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(result.currentStatus)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(result.currentStatus)}
                            {statusLabels[result.currentStatus] || result.currentStatus}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {result.updatedByMember?.fullName || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {result.updatedAt 
                          ? format(new Date(result.updatedAt), 'MMM d, yyyy h:mm a')
                          : 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setUpdateDialogResult(result)}
                            data-testid={`button-edit-${result.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHistoryDialogResult(result)}
                            data-testid={`button-history-${result.id}`}
                          >
                            <History className="w-4 h-4" />
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

        <AddResultDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        
        {updateDialogResult && (
          <UpdateStatusDialog 
            result={updateDialogResult} 
            open={!!updateDialogResult}
            onOpenChange={(open) => !open && setUpdateDialogResult(null)}
          />
        )}
        
        {historyDialogResult && (
          <HistoryDialog 
            result={historyDialogResult} 
            open={!!historyDialogResult}
            onOpenChange={(open) => !open && setHistoryDialogResult(null)}
          />
        )}
      </div>
    </ScrollArea>
  );
}
