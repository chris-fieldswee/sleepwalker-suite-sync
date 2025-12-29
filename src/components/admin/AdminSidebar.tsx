import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Users,
  DoorOpen,
  Calendar,
  LogOut
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

interface AdminSidebarProps {
  onSignOut: () => void;
}

const receptionNavItems = [
  { title: "Panel", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Zadania", url: "/admin/tasks", icon: ClipboardList },
  { title: "Problemy", url: "/admin/issues", icon: AlertTriangle },
];

const adminNavItems = [
  { title: "Użytkownicy", url: "/admin/users", icon: Users },
  { title: "Pokoje", url: "/admin/rooms", icon: DoorOpen },
  { title: "Dostępność personelu", url: "/admin/availability", icon: Calendar },
];

export function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center p-4">
          <img 
            src="/hotel-logo.svg" 
            alt="Hotel Logo" 
            className={`transition-all duration-200 ${open ? 'h-16 w-auto' : 'h-8 w-8'}`}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Reception Features */}
        <SidebarGroup>
          <SidebarGroupLabel>Zarządzanie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {receptionNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Features */}
        <SidebarGroup>
          <SidebarGroupLabel>Administracja</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-sidebar-accent/50"
                onClick={async (e) => {
                  e.preventDefault();
                  await onSignOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                {open && <span>Wyloguj</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
