// /components/sidebarComponents/SidebarIcons.tsx
import React from 'react';
import {
  Plus,
  Cloud,
  Smartphone,
  Pencil, // Import Pencil
  Trash2, // Lucide uses Trash2 for the common trash icon
  Check,
  X,
  Search,
  RefreshCw, // Import RefreshCw
  MessageSquare, // Use MessageSquare as suggested
  Settings,
  LogOut,
  User,
  Trash, // Import Trash (used in SidebarFooter)
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2, // A common loader icon
  FileSpreadsheet, // For CSV/export functionality
  Webhook, // For webhook/integration functionality
  // Add any other icons used in the sidebar footer or elsewhere
} from 'lucide-react';

// Define a type for the icon props to include className and other SVG attributes
type IconProps = React.SVGProps<SVGSVGElement>;

// Export each icon as a functional component that accepts SVG props
export const PlusIcon: React.FC<IconProps> = (props) => <Plus {...props} />;
export const CloudIcon: React.FC<IconProps> = (props) => <Cloud {...props} />;
export const SmartphoneIcon: React.FC<IconProps> = (props) => <Smartphone {...props} />;
export const PencilIcon: React.FC<IconProps> = (props) => <Pencil {...props} />; // Export PencilIcon
export const TrashIcon: React.FC<IconProps> = (props) => <Trash2 {...props} />; // Use Trash2, export as TrashIcon
export const CheckIcon: React.FC<IconProps> = (props) => <Check {...props} />;
export const XIcon: React.FC<IconProps> = (props) => <X {...props} />;
export const SearchIcon: React.FC<IconProps> = (props) => <Search {...props} />;
export const RefreshCwIcon: React.FC<IconProps> = (props) => <RefreshCw {...props} />; // Export RefreshCwIcon
export const MessageSquareIcon: React.FC<IconProps> = (props) => <MessageSquare {...props} />; // Use MessageSquare
export const SettingsIcon: React.FC<IconProps> = (props) => <Settings {...props} />;
export const LogOutIcon: React.FC<IconProps> = (props) => <LogOut {...props} />;
export const UserIcon: React.FC<IconProps> = (props) => <User {...props} />;
export const TrashIconSimple: React.FC<IconProps> = (props) => <Trash {...props} />; // Export basic Trash icon if needed
export const UsersIcon: React.FC<IconProps> = (props) => <Users {...props} />;
export const ChevronDownIcon: React.FC<IconProps> = (props) => <ChevronDown {...props} />;
export const ChevronUpIcon: React.FC<IconProps> = (props) => <ChevronUp {...props} />;
export const AlertCircleIcon: React.FC<IconProps> = (props) => <AlertCircle {...props} />;
export const LoaderIcon: React.FC<IconProps> = (props) => <Loader2 {...props} />; // Export a loader
export const EditIcon: React.FC<IconProps> = (props) => <Pencil {...props} />; // Export EditIcon as Pencil
export const CloudOffIcon: React.FC<IconProps> = (props) => <Cloud {...props} />; // Export CloudOffIcon as Cloud
export const FileSpreadsheetIcon: React.FC<IconProps> = (props) => <FileSpreadsheet {...props} />; // Export CSV icon
export const WebhookIcon: React.FC<IconProps> = (props) => <Webhook {...props} />; // Export Webhook icon
export const ExpandIcon: React.FC<IconProps> = (props) => <ChevronDown {...props} />; // Export ExpandIcon as ChevronDown
export const CollapseIcon: React.FC<IconProps> = (props) => <ChevronUp {...props} />; // Export CollapseIcon as ChevronUp
export const ArchiveIcon: React.FC<IconProps> = (props) => <Users {...props} />; // Export ArchiveIcon as Users
export const MoreIcon: React.FC<IconProps> = (props) => <Users {...props} />; // Export MoreIcon as Users
export const ChevronRightIcon: React.FC<IconProps> = (props) => <ChevronDown {...props} />; // Export ChevronRightIcon as ChevronDown
export const ChevronLeftIcon: React.FC<IconProps> = (props) => <ChevronUp {...props} />; // Export ChevronLeftIcon as ChevronUp


// Re-check imports in NewChatButtons.tsx and SidebarFooter.tsx to ensure they use these exports correctly