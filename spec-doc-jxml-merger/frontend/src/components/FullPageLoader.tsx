interface FullPageLoaderProps {
  message: string
}

function FullPageLoader({ message }: FullPageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-sm"
    >
      <div className="h-12 w-12 rounded-full border-4 border-gl-orange border-t-transparent animate-spin" />
      <p className="text-sm font-medium text-[#303030]">{message}</p>
    </div>
  )
}

export default FullPageLoader
