// components/outerSidebar/PerformanceMonitoringPanel.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring } from '@/app/hooks/usePerformanceMonitoring';

interface PerformanceMonitoringPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  isPinned: boolean;
  onPin: () => void;
}

// Lightweight panel showing key metrics using the new minimal monitor
export function PerformanceMonitoringPanel({ isVisible, onToggle, isPinned, onPin }: PerformanceMonitoringPanelProps) {
  const { metrics, isTracking, startTracking, stopTracking, clearMetrics } = usePerformanceMonitoring();
  const [showDetails, setShowDetails] = useState(false);

  const latest = useMemo(() => {
    const rev = [...metrics].reverse();
    const first = <T,>(arr: T[] | undefined) => (arr && arr.length > 0 ? arr[0] : null) as T | null;
    const get = (name: string) => rev.find(m => m.name === name) || null;
    const load = get('page_load_time')?.value ?? null;
    const dcl = get('dom_content_loaded')?.value ?? null;
    const respEnd = get('response_end')?.value ?? null;
    const lcp = get('LCP')?.value ?? null;
    const cls = get('CLS')?.value ?? null;
    const inp = get('INP')?.value ?? null;
    const ttfb = get('TTFB')?.value ?? null;

    // Top slow resources (by duration)
    const resources = metrics
      .filter(m => m.type === 'resource' && m.name === 'resource_load')
      .map(m => {
        const meta = m.metadata as unknown as { name?: string; initiatorType?: string; transferSize?: number; serverTiming?: { db?: number | null; compute?: number | null; total?: number | null } } | null;
        return {
          duration: m.value,
          name: typeof meta?.name === 'string' ? meta!.name : 'resource',
          initiator: typeof meta?.initiatorType === 'string' ? meta!.initiatorType : 'other',
          size: typeof meta?.transferSize === 'number' ? meta!.transferSize : 0,
          server: meta?.serverTiming ? {
            db: typeof meta.serverTiming.db === 'number' ? meta.serverTiming.db : null,
            compute: typeof meta.serverTiming.compute === 'number' ? meta.serverTiming.compute : null,
            total: typeof meta.serverTiming.total === 'number' ? meta.serverTiming.total : null,
          } : null,
        };
      })
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Generate simple insights
    const insights: string[] = [];
    if (load !== null && lcp !== null && load - lcp > 5000) {
      insights.push('LCP is fast but the load event is delayed. Likely non-critical resources or onload work keeping window.onload open.');
    }
    if (ttfb !== null && ttfb > 800) {
      insights.push('High TTFB. Investigate server latency, data fetching, or cache configuration.');
    }
    if (cls !== null && cls > 0.1) {
      insights.push('CLS above 0.1. Ensure images have width/height and avoid late-loading UI shifts.');
    }
    if (inp !== null && inp > 200) {
      insights.push('INP above 200ms. Look for long tasks after interaction; consider splitting or deferring JS work.');
    }
    const imgHot = resources.some(r => r.initiator === 'img' || r.initiator === 'image');
    if (imgHot) {
      insights.push('Slow images detected. Convert offscreen images to next/image lazy, compress, or use CDN.');
    }
    const scriptHot = resources.some(r => r.initiator === 'script');
    if (scriptHot) {
      insights.push('Slow scripts detected. Defer third-party scripts with next/script lazyOnload or afterInteractive.');
    }

    return { lcp, cls, inp, ttfb, load, dcl, respEnd, resources, insights };
  }, [metrics]);

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Performance Monitor"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,960px)] pointer-events-auto"
    >
      <Card className="border-gray-700/60 bg-gray-900/90 text-gray-100 shadow-2xl backdrop-blur-md rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
          <CardTitle className="text-sm font-semibold tracking-wide text-gray-100">Performance Monitor</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isTracking ? 'default' : 'secondary'}>{isTracking ? 'Tracking' : 'Idle'}</Badge>
            <Button size="sm" variant="outline" className="border-gray-600 text-gray-200" onClick={onPin}>{isPinned ? 'Unpin' : 'Pin'}</Button>
            <Button size="sm" variant="ghost" className="text-gray-300 hover:text-white" onClick={onToggle}>Close</Button>
          </div>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-3">
          {/* Compact metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-300">LCP</span><span className="font-medium">{latest.lcp !== null ? `${Math.round(latest.lcp)} ms` : '–'}</span></div>
            <div className="flex justify-between"><span className="text-gray-300">CLS</span><span className="font-medium">{latest.cls !== null ? Number(latest.cls).toFixed(3) : '–'}</span></div>
            <div className="flex justify-between"><span className="text-gray-300">INP</span><span className="font-medium">{latest.inp !== null ? `${Math.round(latest.inp)} ms` : '–'}</span></div>
            <div className="flex justify-between"><span className="text-gray-300">TTFB</span><span className="font-medium">{latest.ttfb !== null ? `${Math.round(latest.ttfb)} ms` : '–'}</span></div>
            <div className="flex justify-between"><span className="text-gray-300">Load</span><span className="font-medium">{latest.load !== null ? `${Math.round(latest.load)} ms` : '–'}</span></div>
            <div className="flex justify-between"><span className="text-gray-300">DCL</span><span className="font-medium">{latest.dcl !== null ? `${Math.round(latest.dcl)} ms` : '–'}</span></div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {!isTracking ? (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={startTracking}>Start</Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopTracking}>Stop</Button>
            )}
            <Button size="sm" variant="outline" className="border-gray-600 text-gray-200" onClick={clearMetrics}>Clear</Button>
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-200"
              onClick={() => {
                const lines: string[] = [];
                lines.push(`LCP: ${latest.lcp ?? '–'} ms`);
                lines.push(`CLS: ${latest.cls ?? '–'}`);
                lines.push(`INP: ${latest.inp ?? '–'} ms`);
                lines.push(`TTFB: ${latest.ttfb ?? '–'} ms`);
                lines.push(`Page Load: ${latest.load ?? '–'} ms`);
                lines.push(`DOMContentLoaded: ${latest.dcl ?? '–'} ms`);
                if (latest.insights.length) {
                  lines.push('Insights:');
                  latest.insights.forEach(s => lines.push(`- ${s}`));
                }
                if (latest.resources.length) {
                  lines.push('Top Slow Resources:');
                  latest.resources.forEach(r => {
                    const base = `- ${r.name} (${r.initiator}): ${Math.round(r.duration)} ms, ${r.size ? Math.round(r.size/1024)+' KB' : 'size N/A'}`;
                    const srv = (r as unknown as { server?: { db?: number|null; compute?: number|null; total?: number|null } }).server;
                    if (srv && (typeof srv.db === 'number' || typeof srv.compute === 'number' || typeof srv.total === 'number')) {
                      lines.push(base + ` | server: db ${srv.db ?? '-'} ms, c ${srv.compute ?? '-'} ms, t ${srv.total ?? '-'} ms`);
                    } else {
                      lines.push(base);
                    }
                  });
                }
                navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
              }}
            >Copy Report</Button>
            <Button size="sm" variant="ghost" className="text-gray-300 hover:text-white" onClick={() => setShowDetails(v => !v)}>
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>

          {/* Details (Insights + Slow Resources) */}
          {showDetails && (
            <div className="space-y-3">
              {latest.insights.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium text-gray-100 mb-1">Insights</div>
                  <ul className="list-disc pl-5 space-y-1 text-gray-200">
                    {latest.insights.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {latest.resources.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium text-gray-100 mb-1">Top Slow Resources</div>
                  <div className="space-y-1 text-gray-200">
                    {latest.resources.map((r, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="truncate mr-2" title={`${r.name} (${r.initiator})`}>{r.name} <span className="text-gray-400">({r.initiator})</span></span>
                        <span>{Math.round(r.duration)} ms{r.size ? ` • ${Math.round(r.size/1024)} KB` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
