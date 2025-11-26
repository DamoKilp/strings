import { NextRequest, NextResponse } from 'next/server';

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchResponse {
  success: boolean;
  results?: WebSearchResult[];
  error?: string;
}

/**
 * Web search API route for voice AI
 * Supports multiple search providers (Tavily, Serper, or fallback)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, maxResults = 5, searchType = 'general' } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();
    const isNewsSearch = searchType === 'news' || 
      /\b(news|headlines|latest|today|current events|breaking)\b/i.test(searchQuery);
    
    console.log('[WebSearch] Searching for:', searchQuery, '| Type:', isNewsSearch ? 'news' : 'general');

    // Try Tavily API first (if configured)
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (tavilyApiKey) {
      try {
        // Configure Tavily parameters based on search type
        const tavilyParams: Record<string, unknown> = {
          api_key: tavilyApiKey,
          query: searchQuery,
          max_results: maxResults,
          search_depth: 'advanced', // Use advanced for better results
          include_answer: true, // Get a direct answer summary
        };
        
        // For news searches, add news-specific parameters
        if (isNewsSearch) {
          tavilyParams.topic = 'news'; // Focus on news sources
          tavilyParams.days = 3; // Only include results from last 3 days
        }
        
        const tavilyResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tavilyParams),
        });

        if (tavilyResponse.ok) {
          const tavilyData = await tavilyResponse.json();
          const results: WebSearchResult[] = (tavilyData.results || []).map((r: any) => ({
            title: r.title || 'No title',
            url: r.url || '',
            snippet: r.content || r.snippet || '',
          }));
          
          // If Tavily provided a direct answer, prepend it to results for voice consumption
          const answer = tavilyData.answer;
          if (answer && typeof answer === 'string') {
            console.log('[WebSearch] Tavily answer:', answer.substring(0, 100) + '...');
            // Add the answer as a special first result
            results.unshift({
              title: 'Summary',
              url: '',
              snippet: answer,
            });
          }

          console.log('[WebSearch] Tavily search completed:', results.length, 'results', isNewsSearch ? '(news mode)' : '');
          return NextResponse.json({ success: true, results });
        }
      } catch (err) {
        console.warn('[WebSearch] Tavily API error:', err);
      }
    }

    // Try Serper API (if configured)
    const serperApiKey = process.env.SERPER_API_KEY;
    if (serperApiKey) {
      try {
        const serperResponse = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': serperApiKey,
          },
          body: JSON.stringify({
            q: searchQuery,
            num: maxResults,
          }),
        });

        if (serperResponse.ok) {
          const serperData = await serperResponse.json();
          const results: WebSearchResult[] = (serperData.organic || []).map((r: any) => ({
            title: r.title || 'No title',
            url: r.link || '',
            snippet: r.snippet || '',
          }));

          console.log('[WebSearch] Serper search completed:', results.length, 'results');
          return NextResponse.json({ success: true, results });
        }
      } catch (err) {
        console.warn('[WebSearch] Serper API error:', err);
      }
    }

    // Fallback: Use DuckDuckGo HTML scraping (no API key required, but less reliable)
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      const ddgResponse = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (ddgResponse.ok) {
        const html = await ddgResponse.text();
        // Simple HTML parsing for DuckDuckGo results
        const results: WebSearchResult[] = [];
        const titleRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
        const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/g;
        
        let match;
        let count = 0;
        while ((match = titleRegex.exec(html)) !== null && count < maxResults) {
          const url = match[1];
          const title = match[2].trim();
          
          // Try to find corresponding snippet
          const snippetMatch = snippetRegex.exec(html);
          const snippet = snippetMatch ? snippetMatch[1].trim() : '';

          if (url && title) {
            results.push({ title, url, snippet });
            count++;
          }
        }

        if (results.length > 0) {
          console.log('[WebSearch] DuckDuckGo search completed:', results.length, 'results');
          return NextResponse.json({ success: true, results });
        }
      }
    } catch (err) {
      console.warn('[WebSearch] DuckDuckGo fallback error:', err);
    }

    // If all methods fail, return error
    return NextResponse.json(
      {
        success: false,
        error: 'Web search is not configured. Please set TAVILY_API_KEY or SERPER_API_KEY environment variable.',
      },
      { status: 503 }
    );
  } catch (error) {
    console.error('[WebSearch] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



