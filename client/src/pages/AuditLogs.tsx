import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield, 
  User,
  LogIn,
  LogOut,
  Upload,
  UserPlus,
  Edit,
  Trash2,
  ClipboardList,
  Settings,
  FileText,
  RefreshCw,
  Clock,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import type { AuditLog } from "@shared/schema";

const categoryConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  auth: { label: "Authentication", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900" },
  tender: { label: "Tender", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900" },
  team: { label: "Team", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900" },
  config: { label: "Configuration", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900" },
  workflow: { label: "Workflow", color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-100 dark:bg-cyan-900" },
};

const actionIcons: Record<string, React.ElementType> = {
  login: LogIn,
  logout: LogOut,
  upload: Upload,
  team_add: UserPlus,
  team_update: Edit,
  team_delete: Trash2,
  assign: ClipboardList,
  override: Edit,
  config_update: Settings,
  status_change: FileText,
};

export default function AuditLogs() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [limitFilter, setLimitFilter] = useState<string>("100");

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", categoryFilter, limitFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", limitFilter);
      const url = `/api/audit-logs${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Access denied");
        throw new Error("Failed to fetch");
      }
      return res.json();
    },
  });

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return format(new Date(date), "dd MMM yyyy HH:mm:ss");
  };

  const getActionIcon = (action: string) => {
    const Icon = actionIcons[action] || FileText;
    return Icon;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Audit Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track all system activities and user actions
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Category:</span>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40" data-testid="select-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="auth">Authentication</SelectItem>
                    <SelectItem value="tender">Tender</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="config">Configuration</SelectItem>
                    <SelectItem value="workflow">Workflow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={limitFilter} onValueChange={setLimitFilter}>
                  <SelectTrigger className="w-28" data-testid="select-limit-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 logs</SelectItem>
                    <SelectItem value="100">100 logs</SelectItem>
                    <SelectItem value="200">200 logs</SelectItem>
                    <SelectItem value="500">500 logs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                {logs.length} records
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="flex-1 px-6 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-5 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No audit logs yet</h3>
              <p className="text-sm text-muted-foreground">
                System activities will appear here as they occur
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const config = categoryConfig[log.category] || categoryConfig.auth;
              const ActionIcon = getActionIcon(log.action);
              let details: Record<string, any> = {};
              try {
                details = log.details ? JSON.parse(log.details) : {};
              } catch (e) {}

              return (
                <Card key={log.id} className="hover-elevate" data-testid={`card-audit-${log.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-full ${config.bgColor} shrink-0`}>
                        <ActionIcon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${config.bgColor} ${config.color} border-0`}
                          >
                            {config.label}
                          </Badge>
                          {log.targetType && (
                            <span className="text-sm text-muted-foreground">
                              • {log.targetType}: {log.targetName || log.targetId}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.userName || log.userId || "System"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.createdAt)}
                          </span>
                        </div>

                        {Object.keys(details).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                            {Object.entries(details).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                <strong>{key}:</strong> {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
