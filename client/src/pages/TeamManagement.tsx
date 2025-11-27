import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Shield,
  ShieldCheck,
  User,
  Mail,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TeamMember } from "@shared/schema";
import { format } from "date-fns";

type SafeTeamMember = Omit<TeamMember, "password">;

const memberFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  fullName: z.string().min(2, "Full name is required"),
  role: z.enum(["admin", "manager", "bidder"]),
});

type MemberFormValues = z.infer<typeof memberFormSchema>;

const roleConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "Admin", icon: ShieldCheck, variant: "default" },
  manager: { label: "Manager", icon: Shield, variant: "secondary" },
  bidder: { label: "Bidder", icon: User, variant: "outline" },
};

export default function TeamManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SafeTeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<SafeTeamMember | null>(null);

  const { data: members = [], isLoading } = useQuery<SafeTeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      fullName: "",
      role: "bidder",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MemberFormValues) => {
      return apiRequest("POST", "/api/team-members", {
        ...data,
        email: data.email || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Team Member Created",
        description: "The team member has been added successfully.",
      });
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create team member",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MemberFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const payload: any = {
        ...updateData,
        email: updateData.email || null,
      };
      if (!updateData.password) {
        delete payload.password;
      }
      return apiRequest("PUT", `/api/team-members/${id}`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Team Member Updated",
        description: "The team member has been updated successfully.",
      });
      setIsDialogOpen(false);
      setEditingMember(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team member",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Team Member Deleted",
        description: "The team member has been removed.",
      });
      setDeletingMember(null);
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team member",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (member?: SafeTeamMember) => {
    if (member) {
      setEditingMember(member);
      form.reset({
        username: member.username,
        password: "",
        email: member.email || "",
        fullName: member.fullName,
        role: member.role as "admin" | "manager" | "bidder",
      });
    } else {
      setEditingMember(null);
      form.reset({
        username: "",
        password: "",
        email: "",
        fullName: "",
        role: "bidder",
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: MemberFormValues) => {
    if (editingMember) {
      updateMutation.mutate({ ...data, id: editingMember.id });
    } else {
      if (!data.password) {
        form.setError("password", { message: "Password is required for new members" });
        return;
      }
      createMutation.mutate(data);
    }
  };

  const RoleBadge = ({ role }: { role: string }) => {
    const config = roleConfig[role] || roleConfig.bidder;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" />
              Team Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your team members and their roles
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-member">
            <Plus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? "member" : "members"} in your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet</p>
                <p className="text-sm">Add your first team member to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                      <TableCell className="font-medium">{member.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">@{member.username}</TableCell>
                      <TableCell>
                        {member.email ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isActive ? "default" : "secondary"}>
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.lastLoginAt ? (
                          <span className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(member.lastLoginAt), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-sm">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(member)}
                            data-testid={`button-edit-member-${member.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingMember(member)}
                            data-testid={`button-delete-member-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        <Card>
          <CardHeader>
            <CardTitle>Role Descriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="font-medium">Admin</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full access to all features including user management, settings, and tender assignments.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 border border-secondary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-secondary-foreground" />
                  <span className="font-medium">Manager</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Can assign tenders to bidders, review submissions, and track workflow progress.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Bidder</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Can view assigned tenders, update workflow status, and submit bids.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMember ? "Edit Team Member" : "Add Team Member"}
              </DialogTitle>
              <DialogDescription>
                {editingMember
                  ? "Update the team member details below."
                  : "Fill in the details to add a new team member."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} data-testid="input-fullname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="johndoe" {...field} data-testid="input-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Password {editingMember && "(leave blank to keep current)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={editingMember ? "••••••" : "Enter password"}
                          {...field}
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="bidder">Bidder</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-member"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingMember ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingMember} onOpenChange={() => setDeletingMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-medium">{deletingMember?.fullName}</span>? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingMember && deleteMutation.mutate(deletingMember.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  );
}
