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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  const adminClientAvailable = isAdminClientAvailable();

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
        title: "Błąd",
        description: "Nie udało się pobrać użytkowników",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fix admin user role using direct SQL
  useEffect(() => {
    fetchUsers();

    // Get current user ID
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
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
          title: "Błąd",
          description: "Klient administratora niedostępny. Upewnij się, że VITE_SUPABASE_SERVICE_ROLE_KEY jest ustawiony w .env.local",
          variant: "destructive",
        });
        return;
      }

      // 1. Check if user already exists in public.users (by name) or auth.users (by email)
      // This prevents partial failures later
      const { data: existingPublicUsers } = await supabaseAdmin
        .from("users")
        .select("id, auth_id")
        .eq("name", formData.name)
        .maybeSingle();

      if (existingPublicUsers) {
        throw new Error(`Użytkownik o nazwie "${formData.name}" już istnieje.`);
      }

      // Note: We can't easily check auth.users by email without admin privileges, 
      // but createUser will fail if email exists, which is fine.

      // 2. Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          name: formData.name,
          first_name: formData.first_name,
          last_name: formData.last_name,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Nie udało się utworzyć użytkownika auth");

      const newAuthId = authData.user.id;

      try {
        // 3. Insert into public.users
        const { error: userError } = await supabaseAdmin
          .from("users")
          .insert([
            {
              auth_id: newAuthId,
              name: formData.name,
              first_name: formData.first_name,
              last_name: formData.last_name,
              role: formData.role,
              active: formData.active,
            },
          ]);

        if (userError) throw userError;

        // 4. Insert into user_roles
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .upsert([
            {
              user_id: newAuthId,
              role: formData.role as Database["public"]["Enums"]["app_role"],
            },
          ], {
            onConflict: 'user_id,role'
          });

        if (roleError) throw roleError;

        toast({
          title: "Sukces",
          description: "Użytkownik został utworzony pomyślnie",
        });

        setIsCreateDialogOpen(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          first_name: "",
          last_name: "",
          role: "housekeeping" as UserRole,
          active: true,
        });
        await fetchUsers();

      } catch (innerError: any) {
        // ROLLBACK: Delete the auth user if public table inserts fail
        console.error("Transaction failed, rolling back auth user:", innerError);
        await supabaseAdmin.auth.admin.deleteUser(newAuthId);
        throw innerError;
      }

    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Błąd",
        description: `Nie udało się utworzyć użytkownika: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const client = supabaseAdmin ?? supabase;

      // 1. Update public.users
      const { error: userError } = await client
        .from("users")
        .update({
          name: formData.name,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          active: formData.active,
        })
        .eq("id", selectedUser.id);

      if (userError) {
        if (!supabaseAdmin && userError.code === "42501") {
          throw new Error(
            "Aktualizacja zablokowana przez RLS. Zaloguj się jako administrator lub skonfiguruj klucz roli serwisowej."
          );
        }
        throw userError;
      }

      // 2. Update password (if provided)
      if (formData.password && selectedUser.auth_id) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (currentUser?.id === selectedUser.auth_id) {
          // Self-update
          const { error: passwordError } = await supabase.auth.updateUser({
            password: formData.password
          });
          if (passwordError) throw passwordError;
          toast({ title: "Sukces", description: "Hasło zostało zaktualizowane" });
        } else if (supabaseAdmin) {
          // Admin update
          const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
            selectedUser.auth_id,
            { password: formData.password }
          );
          if (passwordError) throw passwordError;
          toast({ title: "Sukces", description: "Hasło użytkownika zostało zaktualizowane" });
        } else {
          toast({
            title: "Ostrzeżenie",
            description: "Nie można zmienić hasła innego użytkownika bez uprawnień administratora (service role).",
            variant: "destructive",
          });
        }
        setFormData((prev) => ({ ...prev, password: "" }));
      }

      // 3. Update user_roles (if role changed)
      if (selectedUser.auth_id && formData.role !== selectedUser.role) {
        // Use a transaction-like approach: delete old, insert new
        // Note: In a real PG function this would be atomic. Here we do best effort.

        const { error: deleteError } = await client
          .from("user_roles")
          .delete()
          .eq("user_id", selectedUser.auth_id);

        if (deleteError) console.warn("Warning: Failed to clear old roles", deleteError);

        const { error: roleError } = await client
          .from("user_roles")
          .insert([{
            user_id: selectedUser.auth_id,
            role: formData.role as Database["public"]["Enums"]["app_role"],
          }]);

        if (roleError) throw new Error(`Nie udało się zaktualizować roli: ${roleError.message}`);
      }

      toast({
        title: "Sukces",
        description: "Użytkownik został zaktualizowany pomyślnie",
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      await fetchUsers();

    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować użytkownika: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, authId: string | null) => {
    try {
      if (!supabaseAdmin) {
        toast({
          title: "Błąd",
          description: "Klient administratora niedostępny. Usuwanie użytkownika wymaga VITE_SUPABASE_SERVICE_ROLE_KEY",
          variant: "destructive",
        });
        return;
      }

      setIsDeleting(true);

      // Best effort cleanup: try to delete from all tables.
      // We don't stop on error for auxiliary tables, but we do for the main user record.

      if (authId) {
        // 1. Delete user roles
        await supabaseAdmin.from("user_roles").delete().eq("user_id", authId);
      }

      // 2. Delete from public.users
      const { error: userError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

      if (userError) throw userError;

      // 3. Delete from auth.users
      if (authId) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authId);
        if (authError) {
          console.warn("Failed to delete auth user (might already be gone):", authError);
        }
      }

      toast({
        title: "Sukces",
        description: "Użytkownik został usunięty pomyślnie",
      });

      await fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Błąd",
        description: `Nie udało się usunąć użytkownika: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData((prev) => ({
      ...prev,
      name: user.name,
      email: "", // Email is managed via auth; keep hidden in edit form
      password: "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role,
      active: user.active,
    }));
    setIsEditDialogOpen(true);
  };

  const getRoleBadge = (role: UserRole) => {
    const config = {
      admin: { label: "Administrator", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
      reception: { label: "Recepcja", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
      housekeeping: { label: "Personel Sprzątający", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
    };
    const { label, className } = config[role] || { label: role, className: "" };
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusBadge = (active: boolean) => {
    return active ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Aktywny</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200">Nieaktywny</Badge>
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
          <h2 className="text-2xl font-bold">Zarządzanie Użytkownikami</h2>
          <p className="text-muted-foreground">Zarządzaj użytkownikami systemu i ich uprawnieniami</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj Użytkownika
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Utwórz Nowego Użytkownika</DialogTitle>
                <DialogDescription>
                  Dodaj nowego użytkownika do systemu z odpowiednią rolą i uprawnieniami.
                </DialogDescription>
                {!adminClientAvailable && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Tworzenie nowych użytkowników wymaga klucza serwisowego Supabase. Skonfiguruj
                    <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-[0.75rem]">VITE_SUPABASE_SERVICE_ROLE_KEY</code>
                    lub zaproś użytkowników przez panel Supabase.
                  </div>
                )}
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Imię i Nazwisko *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Pełne imię i nazwisko"
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
                  <Label htmlFor="password">Hasło *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Wpisz hasło"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Imię</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="Imię"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nazwisko</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Nazwisko"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rola *</Label>
                  <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="reception">Recepcja</SelectItem>
                      <SelectItem value="housekeeping">Personel Sprzątający</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Anuluj
                </Button>
                <Button onClick={handleCreateUser} disabled={!adminClientAvailable}>
                  {adminClientAvailable ? "Utwórz Użytkownika" : "Wymagana rola serwisowa"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="search">Szukaj</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Szukaj po nazwie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-filter">Rola</Label>
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie Role</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="reception">Recepcja</SelectItem>
                  <SelectItem value="housekeeping">Personel Sprzątający</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Użytkownicy ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Zarządzaj wszystkimi użytkownikami systemu i ich uprawnieniami
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Użytkownik</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 data-[state=open]:bg-accent"
                    onClick={handleRoleSort}
                  >
                    Rola
                    {roleSortDirection === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
                    {roleSortDirection === "desc" && <ArrowDown className="ml-2 h-4 w-4" />}
                    {roleSortDirection === null && <ArrowUpDown className="ml-2 h-4 w-4" />}
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Utworzono</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
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
                            <AlertDialogTitle>Usuń Użytkownika</AlertDialogTitle>
                            <AlertDialogDescription>
                              To trwale usunie użytkownika i wszystkie powiązane dane. Tej operacji nie można cofnąć.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.id, user.auth_id)}
                              disabled={isDeleting}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {isDeleting ? "Usuwanie..." : "Usuń"}
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
            <DialogTitle>Edytuj Użytkownika</DialogTitle>
            <DialogDescription>
              Zaktualizuj informacje o użytkowniku i uprawnienia.
            </DialogDescription>
            {!adminClientAvailable && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>Aktualizacje profilu i ról działają bez klucza serwisowego. Możesz zaktualizować własne hasło,
                  ale resetowanie haseł innych użytkowników wymaga klucza serwisowego lub panelu Supabase.</p>
                <div className="mt-2 text-xs font-mono bg-amber-100 p-2 rounded">
                  Debug Info:<br />
                  Mode: {import.meta.env.MODE}<br />
                  Key Present: {import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}<br />
                  Admin Client: {isAdminClientAvailable() ? 'Available' : 'Unavailable'}
                </div>
              </div>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Imię i Nazwisko *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first_name">Imię</Label>
                <Input
                  id="edit-first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last_name">Nazwisko</Label>
                <Input
                  id="edit-last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nowe Hasło (pozostaw puste, aby zachować obecne)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Wpisz nowe hasło"
                disabled={!adminClientAvailable && currentUserId !== selectedUser?.auth_id}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rola *</Label>
              <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="reception">Recepcja</SelectItem>
                  <SelectItem value="housekeeping">Personel Sprzątający</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleEditUser}>
              Zapisz Zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
