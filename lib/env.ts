type HeaderSource = Headers | null | undefined

function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function safeHost(url: string | null) {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function resolveProtocol(headersList?: HeaderSource) {
  const forwarded = headersList?.get('x-forwarded-proto')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null
  }
  const origin = headersList?.get('origin')
  if (origin) {
    try {
      const url = new URL(origin)
      return url.protocol.replace(/:$/, '')
    } catch {
      return null
    }
  }
  return null
}

function resolveHost(headersList?: HeaderSource) {
  return headersList?.get('x-forwarded-host') ?? headersList?.get('host') ?? null
}

export function resolveSiteUrl({
  headersList,
  fallback,
  forceEnv = false,
}: {
  headersList?: HeaderSource
  fallback?: string
  forceEnv?: boolean
} = {}) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const normalizedEnvUrl = envUrl ? stripTrailingSlash(envUrl) : null
  const runtimeHost = resolveHost(headersList)

  if (normalizedEnvUrl) {
    if (!forceEnv && runtimeHost) {
      const envHost = safeHost(normalizedEnvUrl)
      if (envHost && envHost !== runtimeHost) {
        const protocol = resolveProtocol(headersList) ?? (runtimeHost.includes('localhost') ? 'http' : 'https')
        return `${protocol}://${runtimeHost}`
      }
    }
    return normalizedEnvUrl
  }

  if (runtimeHost) {
    const protocol = resolveProtocol(headersList) ?? (runtimeHost.includes('localhost') ? 'http' : 'https')
    return `${protocol}://${runtimeHost}`
  }

  return stripTrailingSlash(fallback ?? 'http://localhost:3000')
}


