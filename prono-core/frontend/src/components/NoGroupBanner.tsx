import { Link } from 'react-router-dom';

interface NoGroupBannerProps {
  message?: string;
}

const NoGroupBanner: React.FC<NoGroupBannerProps> = ({
  message = 'Rejoins ou crée un groupe pour accéder aux paris.',
}) => (
  <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 px-4 py-3 text-amber-800 dark:text-amber-300">
    <span className="text-xl mt-0.5">⚠️</span>
    <div className="text-sm leading-snug">
      <p className="font-semibold mb-1">Tu n'es membre d'aucun groupe</p>
      <p>
        {message}{' '}
        <Link to="/groups" className="underline font-medium hover:opacity-80">
          Gérer mes groupes →
        </Link>
      </p>
    </div>
  </div>
);

export default NoGroupBanner;
