import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, User, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin, isAdminClientAvailable } from "@/integrations/supabase/admin-client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];

type UserRole = Database["public"]["Enums"]["user_role"];

export default function Users() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roleSortDirection, setRoleSortDirection] = useState<"asc" | "desc" | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "housekeeping" as UserRole,
    active: true,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fix admin user role using direct SQL
  useEffect(() => {
    fetchUsers();
  }, []);

  // Reset form data when create dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      setFormData({
        name: "",
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: "housekeeping" as UserRole,
        active: true,
      });
    }
  }, [isCreateDialogOpen]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    if (roleSortDirection === null) return 0;
    const roleOrder = { admin: 0, reception: 1, housekeeping: 2 };
    const aOrder = roleOrder[a.role] ?? 999;
    const bOrder = roleOrder[b.role] ?? 999;
    return roleSortDirection === "asc" 
      ? aOrder - bOrder 
      : bOrder - aOrder;
  });

  const handleRoleSort = () => {
    if (roleSortDirection === null) {
      setRoleSortDirection("asc");
    } else if (roleSortDirection === "asc") {
      setRoleSortDirection("desc");
    } else {
      setRoleSortDirection(null);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!supabaseAdmin) {
        toast({
          title: "Error",
          description: "Admin client not available. Please ensure VITE_SUPABASE_SERVICE_ROLE_KEY is set in .env.local",
          variant: "destructive",
        });
        return;
      }

      // Don't close dialog yet - wait until user is created successfully
      
      // Clean up any existing partial data first (if creating duplicate user)
      if (formData.email) {
        const { data: existingUsers } = await supabaseAdmin
          .from("users")
          .select("auth_id")
          .eq("name", formData.name)
          .limit(1);
        
        if (existingUsers && existingUsers.length > 0) {
          const existingAuthId = existingUsers[0].auth_id;
          // Clean up existing partial data using admin client
          await supabaseAdmin.from("user_roles").delete().eq("user_id", existingAuthId);
          await supabaseAdmin.from("users").delete().eq("auth_id", existingAuthId);
          if (existingAuthId) {
            await supabaseAdmin.auth.admin.deleteUser(existingAuthId);
          }
        }
      }
      
      // Step 1: Create auth user using admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: formData.name,
          first_name: formData.first_name,
          last_name: formData.last_name,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create auth user");

      // Step 2: Insert user into public.users table using admin client to bypass RLS
      const { error: userError } = await supabaseAdmin
        .from("users")
        .insert([
          {
            auth_id: authData.user.id,
            name: formData.name,
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            active: formData.active,
          },
        ]);

      if (userError) {
        // Cleanup: delete the auth user if database insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw userError;
      }

      // Step 3: Insert role into user_roles table for RLS using admin client
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert([
          {
            user_id: authData.user.id,
            role: formData.role as Database["public"]["Enums"]["app_role"],
          },
        ], {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        // Cleanup if role insert fails
        await supabaseAdmin.from("users").delete().eq("auth_id", authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw roleError;
      }

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setIsCreateDialogOpen(false);
      // Reset form data
      setFormData({
        name: "",
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: "housekeeping" as UserRole,
        active: true,
      });
      // Refresh users list
      await fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: `Failed to create user: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      if (!supabaseAdmin) {
        throw new Error("Admin client not available. User update requires VITE_SUPABASE_SERVICE_ROLE_KEY");
      }

      // Update user in users table using admin client to bypass RLS
      const { error: userError } = await supabaseAdmin
        .from("users")
        .update({
          name: formData.name,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          active: formData.active,
        })
        .eq("id", selectedUser.id);

      if (userError) throw userError;

      // Update password if provided
      if (formData.password && selectedUser.auth_id) {
        if (!supabaseAdmin) {
          toast({
            title: "Error",
            description: "Admin client not available. Password update requires VITE_SUPABASE_SERVICE_ROLE_KEY",
            variant: "destructive",
          });
          return;
        }
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          selectedUser.auth_id,
          { password: formData.password }
        );
        
        if (passwordError) {
          console.warn("Password update failed:", passwordError);
          // Don't throw error, just warn
        }
      }

      // Update role in user_roles table if changed
      if (selectedUser.auth_id && formData.role !== selectedUser.role) {
        if (!supabaseAdmin) {
          throw new Error("Admin client not available. Role update requires VITE_SUPABASE_SERVICE_ROLE_KEY");
        }

        // Delete ALL existing roles for this user first (to avoid duplicate key errors)
        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", selectedUser.auth_id);

        if (deleteError) {
          console.warn("Failed to delete old roles:", deleteError);
          throw new Error(`Failed to update user role: ${deleteError.message}`);
        }

        // Insert new role (using upsert to be safe, though we just deleted all roles)
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .upsert([{
            user_id: selectedUser.auth_id,
            role: formData.role as Database["public"]["Enums"]["app_role"],
          }], {
            onConflict: 'user_id,role'
          });

        if (roleError) {
          console.warn("Role update failed:", roleError);
          throw new Error(`Failed to update user role: ${roleError.message}`);
        }
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      
      // Fetch fresh data from server to ensure consistency
      await fetchUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: `Failed to update user: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, authId: string | null) => {
    try {
      if (!supabaseAdmin) {
        toast({
          title: "Error",
          description: "Admin client not available. User deletion requires VITE_SUPABASE_SERVICE_ROLE_KEY",
          variant: "destructive",
        });
        return;
      }

      setIsDeleting(true);

      // Step 1: Delete from user_roles table
      if (authId) {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", authId);

        if (roleError) {
          console.warn("Failed to delete user roles:", roleError);
          // Continue with deletion anyway
        }
      }

      // Step 2: Delete from users table
      const { error: userError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

      if (userError) throw userError;

      // Step 3: Delete from auth.users
      if (authId) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authId);
        if (authError) {
          console.warn("Failed to delete auth user:", authError);
          // Continue anyway - user is already deleted from our tables
        }
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      await fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: "", // Don't populate email in edit (can't change it anyway)
      password: "", // Don't populate password
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role,
      active: user.active,
    });
    setIsEditDialogOpen(true);
  };

  const getRoleBadge = (role: UserRole) => {
    const config = {
      admin: { label: "Admin", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
      reception: { label: "Reception", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
      housekeeping: { label: "Housekeeping", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
    };
    const { label, className } = config[role] || { label: role, className: "" };
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusBadge = (active: boolean) => {
    return active ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200">Inactive</Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system with appropriate role and permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                    <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-filter">Role</Label>
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Manage all system users and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 data-[state=open]:bg-accent"
                    onClick={handleRoleSort}
                  >
                    Role
                    {roleSortDirection === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
                    {roleSortDirection === "desc" && <ArrowDown className="ml-2 h-4 w-4" />}
                    {roleSortDirection === null && <ArrowUpDown className="ml-2 h-4 w-4" />}
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}`
                        : user.name
                      }
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{getStatusBadge(user.active)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the user and all associated data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.id, user.auth_id)}
                              disabled={isDeleting}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first_name">First Name</Label>
                <Input
                  id="edit-first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last_name">Last Name</Label>
                <Input
                  id="edit-last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
