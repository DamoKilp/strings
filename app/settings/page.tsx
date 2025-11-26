import { redirect } from 'next/navigation'

// Redirect /settings to /admin
export default function SettingsPage() {
  redirect('/admin')
}







