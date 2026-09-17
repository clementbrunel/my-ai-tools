interface FullPageLoaderProps {
  message: string
}

function FullPageLoader({ message }: FullPageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white/40"
    >
      <div className="h-12 w-12 rounded-full border-4 border-gl-orange border-t-transparent animate-spin drop-shadow" />
      <p className="text-sm font-medium text-[#303030] bg-white/90 rounded px-3 py-1.5 shadow">{message}</p>
    </div>
  )
}

export default FullPageLoader
