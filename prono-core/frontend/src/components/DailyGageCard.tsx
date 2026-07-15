import React from 'react';
import type { DailyGage } from '@/types';

interface Props {
  gage: DailyGage;
  onVote: (gageId: number, forfeitId: number, vote: number) => void;
  showGroupName?: boolean;
}

const DailyGageCard: React.FC<Props> = ({ gage: g, onVote, showGroupName = false }) => {
  return (
    <div className="space-y-2">
      {showGroupName && (
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">👥 {g.groupName}</p>
      )}

      {g.status === 'SETTLED' ? (
        <div className="card border-2 border-wc-red bg-red-50 dark:bg-red-900/10">
          <div className="flex items-start gap-4">
            <div className="text-4xl">😬</div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Gage attribué</p>
              <p className="text-xl font-black text-wc-red">{g.forfeit?.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{g.forfeit?.description}</p>
              <p className="text-sm mt-2 font-medium">
                👎 <span className="text-wc-red">{g.assignedToDisplayName || g.assignedToUsername}</span> devra l'effectuer
              </p>
            </div>
          </div>
        </div>
      ) : g.status === 'ACTIVE' && g.mode === 'DIRECT' && g.forfeit ? (
        <div className="card border-2 border-wc-green">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🃏</div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Gage de la journée — le moins bon joueur l'écopera !</p>
              <p className="text-xl font-black text-gray-900 dark:text-white">{g.forfeit.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{g.forfeit.description}</p>
            </div>
          </div>
        </div>
      ) : g.mode === 'VOTE' && g.candidates.length > 0 ? (
        <div className="card border-2 border-wc-gold">
          <p className="text-sm text-gray-500 mb-3">
            🗳️ Vote pour le gage du jour — le moins bon joueur écopera du gagnant !
          </p>
          <div className="space-y-2">
            {g.candidates.map((c) => {
              const isLiked = c.userVote === 1;
              const isDisliked = c.userVote === -1;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{c.forfeit.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.forfeit.description}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        c.voteScore > 0 ? 'text-green-500' : c.voteScore < 0 ? 'text-red-500' : 'text-gray-400'
                      }`}
                    >
                      {c.voteScore > 0 ? '+' : ''}{c.voteScore}
                    </span>
                    <button
                      onClick={() => onVote(g.id, c.forfeit.id, isLiked ? 0 : 1)}
                      className={`text-xl transition-transform hover:scale-125 ${isLiked ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
                      title="Pour"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => onVote(g.id, c.forfeit.id, isDisliked ? 0 : -1)}
                      className={`text-xl transition-transform hover:scale-125 ${isDisliked ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
                      title="Contre"
                    >
                      👎
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card border border-dashed text-center py-6 text-gray-400">
          🃏 Gage du jour en attente de configuration par l'admin du groupe
        </div>
      )}
    </div>
  );
};

export default DailyGageCard;
