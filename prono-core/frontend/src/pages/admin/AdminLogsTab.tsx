import React, { useCallback, useEffect, useState } from 'react';
import { getServerLogs } from '@/api/logs';
import type { LogEntry, LogLevel } from '@/types';
import { logger } from '@/utils/logger';
import Pagination from '@/components/Pagination';
import ScrollableTableWrapper from '@/components/ScrollableTableWrapper';

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 4000;
const SEARCH_DEBOUNCE_MS = 400;

const LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

const LEVEL_BADGE_CLASSES: Record<LogLevel, string> = {
  ERROR: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  WARN: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  INFO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  DEBUG: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  TRACE: 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
};

const formatLogTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const AdminLogsTab: React.FC = () => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));

  const fetchLogs = useCallback(async () => {
    try {
      const result = await getServerLogs(currentPage - 1, PAGE_SIZE, debouncedSearch, level);
      setEntries(result.content);
      setTotalElements(result.totalElements);
    } catch (err) {
      logger.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, level]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setIsLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  // Live tail only makes sense while looking at the most recent page.
  useEffect(() => {
    if (!isLive || currentPage !== 1) return;
    const interval = setInterval(fetchLogs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLive, currentPage, fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="🔍 Rechercher dans les logs..."
          className="input-field flex-1 min-w-[200px]"
        />
        <select
          value={level}
          onChange={(e) => { setLevel(e.target.value as LogLevel | ''); setCurrentPage(1); }}
          className="input-field w-auto"
        >
          <option value="">Tous les niveaux</option>
          {LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>{lvl}</option>
          ))}
        </select>
        <button
          onClick={() => setIsLive((v) => !v)}
          className={`px-3 py-2 text-sm rounded-md border transition-colors whitespace-nowrap ${
            isLive
              ? 'border-wc-green bg-wc-green/10 text-wc-green'
              : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={currentPage !== 1 ? 'Le direct ne se met à jour que sur la page 1' : undefined}
        >
          {isLive ? '🟢 Direct' : '⏸️ En pause'}
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {totalElements} entrée{totalElements !== 1 ? 's' : ''} (buffer glissant en mémoire, 5000 max, réinitialisé au redémarrage du serveur)
      </p>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Aucun log</div>
        ) : (
          <ScrollableTableWrapper>
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-3 text-left text-gray-500 uppercase whitespace-nowrap">Heure</th>
                  <th className="py-2 px-3 text-left text-gray-500 uppercase whitespace-nowrap">Niveau</th>
                  <th className="py-2 px-3 text-left text-gray-500 uppercase whitespace-nowrap">Logger</th>
                  <th className="py-2 px-3 text-left text-gray-500 uppercase">Message</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr
                    key={`${entry.timestamp}-${idx}`}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-1.5 px-3 text-gray-400 whitespace-nowrap align-top">
                      {formatLogTime(entry.timestamp)}
                    </td>
                    <td className="py-1.5 px-3 align-top">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LEVEL_BADGE_CLASSES[entry.level]}`}>
                        {entry.level}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-gray-400 align-top max-w-[220px] truncate" title={entry.logger}>
                      {entry.logger.split('.').pop()}
                    </td>
                    <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300 align-top break-all">
                      {entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTableWrapper>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
};

export default AdminLogsTab;
