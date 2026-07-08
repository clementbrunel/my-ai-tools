import { Link } from 'react-router-dom';

const WipBanner = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
    🚧 WIP — {label}
  </span>
);

const F1Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="wc-header rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <WipBanner label="en cours de développement" />
            <h1 className="text-3xl font-black">Bienvenue sur F1 Prono 🏎</h1>
            <p className="text-white/70">Les pronostics Formula 1 arrivent bientôt !</p>
          </div>
          <div className="text-6xl hidden md:block">🏁</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/f1/races"
          className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group"
        >
          <span className="text-4xl">🏁</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Courses</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Pronostiquer les Grands Prix</div>
          </div>
        </Link>
        <Link
          to="/f1/bets"
          className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group"
        >
          <span className="text-4xl">🃏</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Paris F1</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Gages et défis entre amis</div>
          </div>
        </Link>
      </div>

      {/* Coming soon notice */}
      <div className="card text-center py-12 space-y-3">
        <div className="text-6xl">🔧</div>
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Le module F1 est en construction
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          En attendant, reviens sur le foot !
        </p>
        <Link to="/foot" className="btn-primary inline-flex mt-2">
          ⚽ Retour au foot
        </Link>
      </div>
    </div>
  );
};

export default F1Dashboard;
