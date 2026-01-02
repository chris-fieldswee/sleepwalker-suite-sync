import { LayoutDashboard, ClipboardList, AlertTriangle, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { useZgloszoneIssues } from "@/hooks/useZgloszoneIssues";

interface ReceptionSidebarProps {
  onSignOut: () => void;
}

const navItems = [
  { title: "Panel główny", url: "/reception", icon: LayoutDashboard, end: true },
  { title: "Zadania", url: "/reception/tasks", icon: ClipboardList },
  { title: "Problemy", url: "/reception/issues", icon: AlertTriangle },
];

export function ReceptionSidebar({ onSignOut }: ReceptionSidebarProps) {
  const { open } = useSidebar();
  const { hasZgloszoneIssues } = useZgloszoneIssues();

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
        <SidebarGroup>
          <SidebarGroupLabel>Operacje</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50",
                          "overflow-visible"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {open && (
                        <span className="relative inline-flex items-center gap-2 overflow-visible">
                          {item.title}
                          {item.title === "Problemy" && hasZgloszoneIssues && (
                            <span className="relative h-2 w-2 overflow-visible">
                              <span className="absolute inset-0 h-2 w-2 bg-white rounded-full animate-pulse"></span>
                              <span className="absolute -inset-0.5 h-3 w-3 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></span>
                            </span>
                          )}
                        </span>
                      )}
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
                {open && <span>Wyloguj się</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
