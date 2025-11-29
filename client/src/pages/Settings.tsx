import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Settings as SettingsIcon, 
  Save, 
  Loader2,
  Building2,
  TrendingUp,
  CheckCircle2,
  Ban,
  Plus,
  X,
  Trash2,
  RefreshCw,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CompanyCriteria, NegativeKeyword } from "@shared/schema";

const formSchema = z.object({
  turnoverCr: z.string().min(1, "Turnover is required"),
  projectTypes: z.array(z.string()).min(1, "Select at least one project type"),
});

type FormValues = z.infer<typeof formSchema>;

const availableProjectTypes = [
  { id: "Software", label: "Software Development" },
  { id: "Website", label: "Website Development" },
  { id: "Mobile", label: "Mobile App Development" },
  { id: "IT Projects", label: "IT Projects" },
  { id: "Manpower Deployment", label: "Manpower Deployment" },
  { id: "Consulting", label: "IT Consulting" },
  { id: "Maintenance", label: "AMC / Maintenance" },
  { id: "Cloud Services", label: "Cloud Services" },
  { id: "Data Analytics", label: "Data Analytics" },
  { id: "Cybersecurity", label: "Cybersecurity" },
];

export default function Settings() {
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [keywordToDelete, setKeywordToDelete] = useState<NegativeKeyword | null>(null);

  const { data: criteria, isLoading: criteriaLoading } = useQuery<CompanyCriteria>({
    queryKey: ["/api/company-criteria"],
  });

  const { data: negativeKeywords = [], isLoading: keywordsLoading } = useQuery<NegativeKeyword[]>({
    queryKey: ["/api/negative-keywords"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      turnoverCr: "4",
      projectTypes: ["Software", "Website", "Mobile", "IT Projects", "Manpower Deployment"],
    },
  });

  useEffect(() => {
    if (criteria) {
      form.reset({
        turnoverCr: criteria.turnoverCr || "4",
        projectTypes: criteria.projectTypes || ["Software", "Website", "Mobile", "IT Projects", "Manpower Deployment"],
      });
    }
  }, [criteria, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("PUT", "/api/company-criteria", data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your company criteria have been updated successfully.",
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["/api/company-criteria"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const addKeywordMutation = useMutation({
    mutationFn: async (keyword: string) => {
      return apiRequest("POST", "/api/negative-keywords", { keyword });
    },
    onSuccess: () => {
      toast({
        title: "Keyword Added",
        description: "The negative keyword has been added.",
      });
      setNewKeyword("");
      setIsAddingKeyword(false);
      queryClient.invalidateQueries({ queryKey: ["/api/negative-keywords"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_relevant"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add keyword",
        variant: "destructive",
      });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/negative-keywords/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Keyword Deleted",
        description: "The negative keyword has been removed. Tenders are being re-analyzed.",
      });
      setKeywordToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/negative-keywords"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_relevant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "manual_review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete keyword",
        variant: "destructive",
      });
      setKeywordToDelete(null);
    },
  });

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate(data);
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      addKeywordMutation.mutate(newKeyword.trim());
    }
  };

  const confirmDeleteKeyword = () => {
    if (keywordToDelete) {
      deleteKeywordMutation.mutate(keywordToDelete.id);
    }
  };

  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tenders/reanalyze");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Re-analysis Started",
        description: data.message || "Re-analysis is running in the background. Check progress in the sidebar.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reanalyze-status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to re-analyze tenders",
        variant: "destructive",
      });
    },
  });

  const fixDatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tenders/fix-dates");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Dates Fixed",
        description: data.message || `Fixed ${data.fixed} tender dates.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_relevant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "manual_review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "missed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fix dates",
        variant: "destructive",
      });
    },
  });

  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tenders/cleanup-duplicates");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Duplicates Cleaned Up",
        description: data.message || `Removed ${data.duplicatesRemoved} duplicate tenders.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_eligible"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "not_relevant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "manual_review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/status", "missed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders/corrigendum"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cleanup duplicates",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your company criteria and negative keywords for tender matching
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company Criteria
            </CardTitle>
            <CardDescription>
              Define your company's eligibility criteria. Tenders will be matched against these requirements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {criteriaLoading ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-6" />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="turnoverCr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Average Turnover (in Crores)
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="4"
                              {...field}
                              className="pr-12"
                              data-testid="input-turnover"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              Cr
                            </span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Your company's average annual turnover. Tenders requiring higher turnover will show lower match percentage.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectTypes"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel>Project Types</FormLabel>
                          <FormDescription>
                            Select the types of projects your company handles. Tenders will be tagged and matched based on these.
                          </FormDescription>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availableProjectTypes.map((item) => (
                            <FormField
                              key={item.id}
                              control={form.control}
                              name="projectTypes"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={item.id}
                                    className="flex items-center space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(item.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, item.id])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== item.id
                                                )
                                              );
                                        }}
                                        data-testid={`checkbox-project-${item.id.toLowerCase().replace(/\s+/g, '-')}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">
                                      {item.label}
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending || isSaved}
                      data-testid="button-save-settings"
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : isSaved ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Saved
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Negative Keywords
            </CardTitle>
            <CardDescription>
              Tenders containing these keywords will be automatically marked as "Not Relevant" and filtered out.
              Examples: "data acquisition system", "Email purchase", "Hardware procurement"
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keywordsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {isAddingKeyword ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter negative keyword..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                        if (e.key === 'Escape') {
                          setIsAddingKeyword(false);
                          setNewKeyword("");
                        }
                      }}
                      autoFocus
                      data-testid="input-new-keyword"
                    />
                    <Button
                      onClick={handleAddKeyword}
                      disabled={addKeywordMutation.isPending || !newKeyword.trim()}
                      data-testid="button-save-keyword"
                    >
                      {addKeywordMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsAddingKeyword(false);
                        setNewKeyword("");
                      }}
                      data-testid="button-cancel-keyword"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingKeyword(true)}
                    data-testid="button-add-keyword"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Keyword
                  </Button>
                )}

                {negativeKeywords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ban className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No negative keywords defined</p>
                    <p className="text-sm">Add keywords to filter out irrelevant tenders</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {negativeKeywords.map((kw) => (
                      <Badge
                        key={kw.id}
                        variant="outline"
                        className="flex items-center gap-2 py-1.5 px-3 text-sm"
                        data-testid={`badge-keyword-${kw.id}`}
                      >
                        <span>{kw.keyword}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-destructive/10"
                          onClick={() => setKeywordToDelete(kw)}
                          disabled={deleteKeywordMutation.isPending}
                          data-testid={`button-delete-keyword-${kw.id}`}
                        >
                          {deleteKeywordMutation.isPending && keywordToDelete?.id === kw.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                          )}
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}

                {negativeKeywords.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    {negativeKeywords.length} keyword{negativeKeywords.length !== 1 ? 's' : ''} configured. 
                    Tenders matching any of these keywords will be automatically filtered to "Not Relevant".
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Re-analyze Tenders
            </CardTitle>
            <CardDescription>
              Re-run the eligibility analysis on all existing tenders using the current criteria and negative keywords.
              This is useful after changing settings or when the matching logic has been updated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will re-analyze all tenders that haven't been manually overridden. 
                Manually overridden tenders will keep their current status.
              </p>
              <Button
                onClick={() => reanalyzeMutation.mutate()}
                disabled={reanalyzeMutation.isPending}
                data-testid="button-reanalyze-tenders"
              >
                {reanalyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-analyze All Tenders
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Fix Date Formats
            </CardTitle>
            <CardDescription>
              Re-parse all tender dates from the original Excel data using DD-MM-YYYY format.
              Use this if dates appear to have day and month swapped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will fix all tender dates that were incorrectly parsed. 
                After fixing, the "Missed Tenders" category will be updated automatically.
              </p>
              <Button
                onClick={() => fixDatesMutation.mutate()}
                disabled={fixDatesMutation.isPending}
                data-testid="button-fix-dates"
              >
                {fixDatesMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fixing Dates...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Fix All Dates
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Cleanup Duplicate Tenders
            </CardTitle>
            <CardDescription>
              Remove duplicate tenders with the same T247 ID. Keeps the most recent entry and marks it as a corrigendum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will find all duplicate T247 IDs, keep only the most recent version, 
                and mark them as corrigendum. Run this if you have uploaded the same Excel file multiple times.
              </p>
              <Button
                onClick={() => cleanupDuplicatesMutation.mutate()}
                disabled={cleanupDuplicatesMutation.isPending}
                data-testid="button-cleanup-duplicates"
              >
                {cleanupDuplicatesMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cleaning Up...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cleanup Duplicates
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Disclaimer */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            This software is effective from 01 December 2025. Data prior to this date is not available.
          </p>
        </div>
      </div>

      <AlertDialog open={keywordToDelete !== null} onOpenChange={() => setKeywordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Negative Keyword</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the keyword "{keywordToDelete?.keyword}"?
              This will re-analyze all tenders that were filtered by this keyword, which may take a moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-keyword">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteKeyword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-keyword"
            >
              {deleteKeywordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
