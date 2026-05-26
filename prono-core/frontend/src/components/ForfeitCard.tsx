import type { Forfeit } from '../types';

interface ForfeitCardProps {
  forfeit: Forfeit;
  isAssigned?: boolean;
  isCompleted?: boolean;
  assignedBy?: string;
}

const categoryEmoji: Record<string, string> = {
  Humiliation: '😂',
  Spectacle: '🎭',
  'Réseaux sociaux': '📱',
  Boissons: '🍺',
  Maquillage: '💄',
  Cuisine: '👨‍🍳',
  Corvée: '🧹',
  General: '🃏',
};

const ForfeitCard: React.FC<ForfeitCardProps> = ({
  forfeit,
  isAssigned = false,
  isCompleted = false,
  assignedBy,
}) => {
  return (
    <div className={`card border-2 ${
      isCompleted
        ? 'border-green-300 dark:border-green-700 opacity-60'
        : isAssigned
        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
        : 'border-transparent'
    }`}>
      <div className="flex items-start gap-3">
        <div className="text-3xl">
          {categoryEmoji[forfeit.category] || '🃏'}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-bold text-sm ${
              isCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'
            }`}>
              {forfeit.title}
            </h3>
            {isCompleted && (
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold">✅ Accompli</span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{forfeit.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {categoryEmoji[forfeit.category] || '🃏'} {forfeit.category}
            </span>
            {assignedBy && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Assigné par {assignedBy}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForfeitCard;
