interface FullPageLoaderProps {
  message: string
}

function FullPageLoader({ message }: FullPageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40"
    >
      <div className="flex items-center gap-3 rounded-full bg-white/95 shadow-lg px-5 py-3">
        <div className="h-6 w-6 shrink-0 rounded-full border-[3px] border-gl-orange border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-[#303030] whitespace-nowrap">{message}</p>
      </div>
    </div>
  )
}

export default FullPageLoader
