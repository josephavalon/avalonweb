// Deprecated — shadcn sidebar shell was never wired into the Avalon tree.
// Stubbed to null exports so Vite tree-shakes it and nothing accidentally
// pulls @radix-ui/react-* deps we don't ship. Re-scaffold from shadcn CLI
// when the members dashboard ships.
export const Sidebar = () => null;
export const SidebarProvider = ({ children }) => children ?? null;
export const SidebarTrigger = () => null;
export const SidebarInset = ({ children }) => children ?? null;
export const SidebarContent = () => null;
export const SidebarFooter = () => null;
export const SidebarGroup = () => null;
export const SidebarGroupAction = () => null;
export const SidebarGroupContent = () => null;
export const SidebarGroupLabel = () => null;
export const SidebarHeader = () => null;
export const SidebarInput = () => null;
export const SidebarMenu = () => null;
export const SidebarMenuAction = () => null;
export const SidebarMenuBadge = () => null;
export const SidebarMenuButton = () => null;
export const SidebarMenuItem = () => null;
export const SidebarMenuSkeleton = () => null;
export const SidebarMenuSub = () => null;
export const SidebarMenuSubButton = () => null;
export const SidebarMenuSubItem = () => null;
export const SidebarRail = () => null;
export const SidebarSeparator = () => null;
export const useSidebar = () => ({ open: false, setOpen: () => {}, toggleSidebar: () => {} });
