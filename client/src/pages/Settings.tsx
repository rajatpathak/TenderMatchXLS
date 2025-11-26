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
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CompanyCriteria } from "@shared/schema";

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

  const { data: criteria, isLoading } = useQuery<CompanyCriteria>({
    queryKey: ["/api/company-criteria"],
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

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your company criteria for tender matching
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
          {isLoading ? (
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
    </div>
  );
}
