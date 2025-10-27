'use client'

import { signInAction, signUpAction } from "@/app/actions";
import React, { useState, useEffect } from "react";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemedBackground } from "@/components/themed-background";

type TabType = 'signin' | 'signup';

export default function Login({ searchParams }: { searchParams: Promise<Message> }) {
  const [activeTab, setActiveTab] = useState<TabType>('signin');
  const [params, setParams] = useState<Message>({ message: '' });
  
  useEffect(() => {
    searchParams.then(setParams);
  }, [searchParams]);

  return (
    <>
      <ThemedBackground />
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Left Side - Branding & Info */}
          <div className="glass-large glass-legible rounded-3xl p-8 lg:p-12 space-y-8">
            {/* Brand Header */}
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-small">
                {/* Placeholder */}
                <div className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Strings</h1>
                <p className="text-lg opacity-80">AI Chat Workspace</p>
              </div>
            </div>

            {/* Platform Stats (placeholders) */}
            <div className="rounded-2xl p-6 space-y-4 border border-white/10">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 opacity-80">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4 space-y-2 border border-white/10">
                  <span className="text-2xl font-bold">Multi‑Model</span>
                  <p className="text-xs opacity-80">Providers</p>
                </div>
                <div className="rounded-xl p-4 space-y-2 border border-white/10">
                  <span className="text-2xl font-bold">Vector</span>
                  <p className="text-xs opacity-80">Search Ready</p>
                </div>
                <div className="rounded-xl p-4 space-y-2 border border-white/10">
                  <span className="text-2xl font-bold">RLS</span>
                  <p className="text-xs opacity-80">Secure</p>
                </div>
                <div className="rounded-xl p-4 space-y-2 border border-white/10">
                  <span className="text-2xl font-bold">Streaming</span>
                  <p className="text-xs opacity-80">Chat</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Forms */}
          <div className="rounded-3xl p-8 lg:p-12 border border-white/10">
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="flex gap-2 border-b border-white/10">
                <button
                  onClick={() => setActiveTab('signin')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'signin' 
                      ? 'border-b-2 border-white text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab('signup')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'signup' 
                      ? 'border-b-2 border-white text-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form Content */}
              {activeTab === 'signin' ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">Welcome Back</h2>
                    <p className="opacity-80">Sign in to continue</p>
                  </div>

                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Input 
                        name="email" 
                        type="email"
                        placeholder="you@example.com" 
                        required 
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <Input 
                        type="password" 
                        name="password" 
                        placeholder="Enter your password" 
                        required 
                        className="h-12"
                      />
                    </div>

                    <SubmitButton 
                      formAction={signInAction} 
                      className="w-full h-12 text-base font-semibold border border-white/10 rounded-md"
                      pendingText="Signing In..."
                    >
                      Sign In
                    </SubmitButton>
                    
                    <FormMessage message={params} />
                  </form>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">Create Account</h2>
                    <p className="opacity-80">Start your AI journey</p>
                  </div>

                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Input 
                        name="email" 
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com" 
                        required 
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">
                        Password
                      </Label>
                      <Input 
                        type="password" 
                        name="password" 
                        id="signup-password"
                        placeholder="Create a password" 
                        required 
                        className="h-12"
                      />
                    </div>

                    <SubmitButton 
                      formAction={signUpAction} 
                      className="w-full h-12 text-base font-semibold border border-white/10 rounded-md"
                      pendingText="Creating Account..."
                    >
                      Create Account
                    </SubmitButton>
                    
                    <FormMessage message={params} />
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


