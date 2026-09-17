function Header() {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-gl-dark shadow-sm">
      <div className="flex items-center gap-2 shrink-0">
        <span className="h-6 w-6 rounded-sm bg-gradient-to-br from-gl-orange to-gl-orange-dark" />
        <span className="text-white font-semibold text-sm">Spec Doc/JXML Merger</span>
      </div>
    </header>
  )
}

export default Header
