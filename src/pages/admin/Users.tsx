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
import { Plus, Search, Edit, Trash2, User, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, KeyRound, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin, isAdminClientAvailable } from "@/integrations/supabase/admin-client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { userCreationSchema } from "@/lib/validation";
import { generatePassword } from "@/lib/passwordGenerator";
import { PasswordStrengthIndicator } from "@/components/admin/PasswordStrengthIndicator";
import { CredentialShareDialog } from "@/components/admin/CredentialShareDialog";

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
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ email: string; password: string; userName: string } | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

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
      setValidationErrors({});
      setShowPassword(false);
      setEmailExists(false);
      setPasswordCopied(false);
    }
  }, [isCreateDialogOpen]);

  // Check for duplicate email
  useEffect(() => {
    const checkEmail = async () => {
      if (!formData.email || !supabaseAdmin) {
        setEmailExists(false);
        return;
      }

      // Validate email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setEmailExists(false);
        return;
      }

      try {
        // Try to create user to check if email exists
        // We'll use a different approach - check via admin API
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (!error && data) {
          const exists = data.users.some(user => user.email === formData.email);
          setEmailExists(exists);
        }
      } catch (error) {
        // If check fails, don't show error - let createUser handle it
        setEmailExists(false);
      }
    };

    const timeoutId = setTimeout(checkEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.email]);

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

  const handleGeneratePassword = () => {
    const newPassword = generatePassword({
      length: 16,
      includeSpecialChars: true,
      includeNumbers: true,
      includeUppercase: true,
      includeLowercase: true,
    });
    setFormData({ ...formData, password: newPassword });
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleCopyPassword = async () => {
    if (formData.password) {
      try {
        await navigator.clipboard.writeText(formData.password);
        setPasswordCopied(true);
        toast({
          title: "Skopiowano",
          description: "Hasło zostało skopiowane do schowka",
        });
        setTimeout(() => setPasswordCopied(false), 2000);
      } catch (error) {
        toast({
          title: "Błąd",
          description: "Nie udało się skopiować hasła",
          variant: "destructive",
        });
      }
    }
  };

  const validateForm = (): boolean => {
    try {
      userCreationSchema.parse(formData);
      setValidationErrors({});
      return true;
    } catch (error: any) {
      const errors: Record<string, string> = {};
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path && err.path.length > 0) {
            errors[err.path[0]] = err.message;
          }
        });
      }
      setValidationErrors(errors);
      return false;
    }
  };

  const handleCreateUser = async () => {
    // Validate form
    if (!validateForm()) {
      toast({
        title: "Błąd walidacji",
        description: "Proszę poprawić błędy w formularzu",
        variant: "destructive",
      });
      return;
    }

    if (emailExists) {
      toast({
        title: "Błąd",
        description: "Użytkownik o tym adresie email już istnieje",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      if (!supabaseAdmin) {
        toast({
          title: "Błąd",
          description: "Klient administratora niedostępny. Upewnij się, że VITE_SUPABASE_SERVICE_ROLE_KEY jest ustawiony w .env.local",
          variant: "destructive",
        });
        return;
      }

      // 1. Check if user already exists in public.users (by name)
      const { data: existingPublicUsers } = await supabaseAdmin
        .from("users")
        .select("id, auth_id")
        .eq("name", formData.name)
        .maybeSingle();

      if (existingPublicUsers) {
        throw new Error(`Użytkownik o nazwie "${formData.name}" już istnieje.`);
      }

      // 2. Create auth user with requires_password_change flag
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          name: formData.name,
          first_name: formData.first_name,
          last_name: formData.last_name,
          requires_password_change: true,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Nie udało się utworzyć użytkownika auth");

      const newAuthId = authData.user.id;

      try {
        // 3. Upsert into public.users (handle case where trigger already created entry)
        // The handle_new_user() trigger may have already created a user entry
        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("auth_id", newAuthId)
          .maybeSingle();

        let userError;
        if (existingUser) {
          // Update existing user
          const { error } = await supabaseAdmin
            .from("users")
            .update({
              name: formData.name,
              first_name: formData.first_name,
              last_name: formData.last_name,
              role: formData.role,
              active: formData.active,
            })
            .eq("auth_id", newAuthId);
          userError = error;
        } else {
          // Insert new user
          const { error } = await supabaseAdmin
            .from("users")
            .insert({
              auth_id: newAuthId,
              name: formData.name,
              first_name: formData.first_name,
              last_name: formData.last_name,
              role: formData.role,
              active: formData.active,
            });
          userError = error;
        }

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

        // Store credentials for sharing dialog
        setCreatedUserCredentials({
          email: formData.email,
          password: formData.password,
          userName: formData.name,
        });

        // Close create dialog and show credential dialog
        setIsCreateDialogOpen(false);
        setShowCredentialDialog(true);

        // Reset form
        setFormData({
          name: "",
          email: "",
          password: "",
          first_name: "",
          last_name: "",
          role: "housekeeping" as UserRole,
          active: true,
        });
        setValidationErrors({});
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
    } finally {
      setIsCreating(false);
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
          <h2 className="text-2xl font-bold">Zarządzanie użytkownikami</h2>
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
                <DialogTitle>Utwórz nowego użytkownika</DialogTitle>
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
                    <Label htmlFor="name">Nazwa użytkownika *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (validationErrors.name) {
                          setValidationErrors({ ...validationErrors, name: "" });
                        }
                      }}
                      placeholder="Pełne imię i nazwisko"
                      className={validationErrors.name ? "border-red-500" : ""}
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-red-500">{validationErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (validationErrors.email) {
                          setValidationErrors({ ...validationErrors, email: "" });
                        }
                      }}
                      placeholder="user@example.com"
                      className={validationErrors.email || emailExists ? "border-red-500" : ""}
                    />
                    {validationErrors.email && (
                      <p className="text-sm text-red-500">{validationErrors.email}</p>
                    )}
                    {emailExists && !validationErrors.email && (
                      <p className="text-sm text-red-500">Użytkownik o tym adresie email już istnieje</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Hasło *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleGeneratePassword}
                        className="h-8 text-xs"
                      >
                        <KeyRound className="h-3 w-3 mr-1" />
                        Generuj
                      </Button>
                      {formData.password && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyPassword}
                          className="h-8 text-xs"
                        >
                          {passwordCopied ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Skopiowano
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" />
                              Kopiuj
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (validationErrors.password) {
                          setValidationErrors({ ...validationErrors, password: "" });
                        }
                      }}
                      placeholder="Wpisz hasło (min. 8 znaków)"
                      className={validationErrors.password ? "border-red-500 pr-10" : "pr-10"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {validationErrors.password && (
                    <p className="text-sm text-red-500">{validationErrors.password}</p>
                  )}
                  {formData.password && (
                    <PasswordStrengthIndicator password={formData.password} minLength={8} />
                  )}
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
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                  Anuluj
                </Button>
                <Button onClick={handleCreateUser} disabled={!adminClientAvailable || isCreating}>
                  {isCreating ? "Tworzenie..." : adminClientAvailable ? "Utwórz Użytkownika" : "Wymagana rola serwisowa"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Credential Share Dialog */}
      {createdUserCredentials && (
        <CredentialShareDialog
          open={showCredentialDialog}
          onOpenChange={(open) => {
            setShowCredentialDialog(open);
            if (!open) {
              // Clear credentials after dialog is closed
              setCreatedUserCredentials(null);
            }
          }}
          email={createdUserCredentials.email}
          password={createdUserCredentials.password}
          userName={createdUserCredentials.userName}
        />
      )}

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
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 sticky top-0 z-10">
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
                              <AlertDialogTitle>Usuń użytkownika</AlertDialogTitle>
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
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj użytkownika</DialogTitle>
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
