'use client'

import { signInAction } from "@/app/actions";
import React, { useState, useEffect } from "react";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// ThemedBackground is now in root layout - no need to import here

export default function Login({ searchParams }: { searchParams: Promise<Message> }) {
  const [params, setParams] = useState<Message>({ message: '' });
  const [configCheck, setConfigCheck] = useState<{ hasUrl: boolean; hasKey: boolean } | null>(null);
  
  useEffect(() => {
    searchParams.then(setParams);
    // Check if Supabase config is available (client-side only)
    // Note: NEXT_PUBLIC_ vars are available on client, but we check at runtime
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      setConfigCheck({
        hasUrl: !!supabaseUrl && supabaseUrl.length > 0,
        hasKey: !!supabaseKey && supabaseKey.length > 0,
      });
    }
  }, [searchParams]);

  return (
    <>
      {/* ThemedBackground is provided by root layout - no need to render here */}
      <div className="flex min-h-[100dvh] w-full items-center justify-center px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
        <div className="w-full max-w-md">
          {/* Auth Form */}
          <div className="glass-medium glass-legible rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-12 border border-white/20 dark:border-slate-700/40">
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-1 sm:space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold glass-text-primary">Welcome Back</h2>
                <p className="text-sm sm:text-base glass-text-secondary">Sign in to continue</p>
              </div>

              <form className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium glass-text-primary">
                    Email Address
                  </Label>
                  <Input 
                    name="email" 
                    id="email"
                    type="email"
                    placeholder="you@example.com" 
                    required 
                    className="glass-small border-0 glass-text-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400/50 h-11 sm:h-12"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium glass-text-primary">
                    Password
                  </Label>
                  <Input 
                    type="password" 
                    name="password" 
                    id="password"
                    placeholder="Enter your password" 
                    required 
                    className="glass-small border-0 glass-text-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400/50 h-11 sm:h-12"
                  />
                </div>

                <SubmitButton 
                  formAction={signInAction} 
                  className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold glass-small glass-interactive glass-text-primary rounded-md transition-all hover:bg-white/15 active:scale-[0.98]"
                  pendingText="Signing In..."
                >
                  Sign In
                </SubmitButton>
                
                <FormMessage message={params} />
                
                {/* Configuration check (development only) */}
                {process.env.NODE_ENV === 'development' && configCheck && (!configCheck.hasUrl || !configCheck.hasKey) && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/20 dark:bg-yellow-500/10 border border-yellow-500/50 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300 text-xs">
                    <p className="font-semibold mb-1">⚠️ Configuration Warning</p>
                    <p>Missing Supabase environment variables:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {!configCheck.hasUrl && <li>NEXT_PUBLIC_SUPABASE_URL</li>}
                      {!configCheck.hasKey && <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>}
                    </ul>
                    <p className="mt-2 opacity-80">Check your .env file</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


