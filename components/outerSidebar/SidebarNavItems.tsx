import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useRBAC } from '@/app/hooks/useRBAC';
import { Permission } from '@/types/rbac';

// Modern, full-color icons from react-icons for Zen browser-like appearance
import {
  MdHome,
  MdShield,
  MdNavigation,
  MdGames,
  MdCloudUpload,
  MdAccountBalance,
} from 'react-icons/md';
import {
  BsGraphUpArrow,
  BsJoystick
} from 'react-icons/bs';

interface SidebarNavItemsProps {
  orientation?: "vertical" | "horizontal";
  onNavigate?: () => void; // For closing drawer on mobile
  showTooltips?: boolean;
  iconSize?: number;
  className?: string;
}

const NAV_ITEMS = [
  {
    href: "/",
    icon: MdHome,
    label: "Home",
    color: "#4f46e5", // indigo
    visible: true,
    gradient: "from-indigo-500 to-purple-600"
  },
  {
    href: "/health/import",
    icon: MdCloudUpload,
    label: "Health Import",
    color: "#10b981", // emerald
    visible: true,
    gradient: "from-emerald-500 to-teal-600"
  },
  {
    href: "/finance",
    icon: MdAccountBalance,
    label: "Finance",
    color: "#3b82f6", // blue
    visible: true,
    gradient: "from-blue-500 to-cyan-600"
  },
  {
    href: "/admin",
    icon: MdShield,
    label: "Admin",
    color: "#dc2626", // red
    visible: false, // Will be shown based on admin permissions
    requiresPermission: true,
    gradient: "from-red-500 to-rose-600"
  },
  {
    href: "/navaids",
    icon: MdNavigation,
    label: "Navaids",
    color: "#ec4899", // pink
    visible: false, // Hidden for regular users - can be enabled via feature flag
    gradient: "from-pink-500 to-fuchsia-600"
  },
  {
    href: "/analytics",
    icon: BsGraphUpArrow,
    label: "Analytics",
    color: "#f59e0b", // amber
    visible: false, // Hidden for regular users - can be enabled via feature flag
    gradient: "from-amber-500 to-orange-600"
  },
  {
    href: "/games/neon-snake",
    icon: MdGames,
    label: "Neon Snake",
    color: "#10b981", // emerald green
    visible: false,
    gradient: "from-emerald-500 to-green-600"
  },
  {
    href: "/games/super-mario",
    icon: BsJoystick,
    label: "Super Mario",
    color: "#ef4444", // red like Mario's hat
    visible: false,
    gradient: "from-red-500 to-pink-600"
  },
];

export function SidebarNavItems({
  orientation = "vertical",
  onNavigate,
  showTooltips = true,
  iconSize = 22,
  className = "",
}: SidebarNavItemsProps) {
  const pathname = usePathname();
  const { hasPermission } = useRBAC();
  
  // Check if user has admin permissions
  const hasAdminAccess = hasPermission(Permission.MANAGE_ROLES) || 
                        hasPermission(Permission.MANAGE_USERS) || 
                        hasPermission(Permission.SYSTEM_CONFIG);
  const canAccessDeveloperTools = hasPermission(Permission.DEVELOPMENT_TOOLS);
  
  
  // Filter nav items based on visibility and permissions
  const navItems = NAV_ITEMS.filter(item => {
    if (item.requiresPermission) {
      return hasAdminAccess;
    }
    return item.visible;
  });

  return (
    <div
      className={
        orientation === "vertical"
          ? `flex flex-col items-center gap-4 ${className}`
          : `flex flex-row items-center justify-around w-full ${className}`
      }
    >
      {navItems.map((item) => {
        const isActive = 
          item.href === "/"
            ? pathname === "/" // Home is active only on exact root path
            : item.href === "/admin"
            ? pathname.startsWith("/admin") || pathname === "/settings"
            : pathname.startsWith(item.href);

        // Regular nav item (non-Projects or when on Projects page)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative group`}
            onClick={onNavigate}
            tabIndex={0}
            aria-label={item.label}
          >
            <div
              className={`
                rounded-xl transition-all duration-300
                ${isActive
                  ? 'bg-gradient-to-br text-white shadow-lg transform scale-105'
                  : 'text-gray-100 hover:text-white hover:shadow-md hover:transform hover:scale-102'
                }
              `}
              style={{
                minWidth: 48,
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive
                  ? `linear-gradient(135deg, ${item.gradient.split(' ').join(', ')})`
                  : 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <item.icon
                size={iconSize + 2}
                className={isActive ? 'text-white' : 'text-gray-300 hover:text-gray-100'}
                style={{
                  filter: isActive ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
            {showTooltips && orientation === "vertical" && (
              <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap">
                {item.label}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
