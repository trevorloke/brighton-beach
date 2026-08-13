import { useCallback, useEffect, useState } from 'react';
import { BASE_CONTENT } from './engine/content';
import { applyAction, createGame, deserialize, serialize, EngineError } from './engine/engine';
import type { GameAction, GameConfig, GameState } from './engine/types';
import { Lobby } from './ui/Lobby';
import { Game } from './ui/Game';

const SAVE_KEY = 'brighton-beach-save-v1';

export interface Toast {
  id: number;
  text: string;
  error: boolean;
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hasSave, setHasSave] = useState<boolean>(() => localStorage.getItem(SAVE_KEY) !== null);

  const pushToast = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Persist after every state change so a closed tab can always resume.
  useEffect(() => {
    if (game && game.phase !== 'game-over') {
      localStorage.setItem(SAVE_KEY, serialize(game));
      setHasSave(true);
    }
  }, [game]);

  const startGame = useCallback((config: GameConfig) => {
    setGame(createGame(BASE_CONTENT, config));
  }, []);

  const resumeGame = useCallback(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      setGame(deserialize(raw));
    } catch {
      pushToast('That save could not be read.', true);
      localStorage.removeItem(SAVE_KEY);
      setHasSave(false);
    }
  }, [pushToast]);

  const dispatch = useCallback(
    (action: GameAction) => {
      setGame((current) => {
        if (!current) return current;
        try {
          return applyAction(BASE_CONTENT, current, action);
        } catch (err) {
          if (err instanceof EngineError) {
            pushToast(err.message, true);
            return current;
          }
          throw err;
        }
      });
    },
    [pushToast],
  );

  const exitToLobby = useCallback(() => {
    setGame(null);
    setHasSave(localStorage.getItem(SAVE_KEY) !== null);
  }, []);

  const abandonSave = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    setHasSave(false);
  }, []);

  return (
    <>
      {game ? (
        <Game
          content={BASE_CONTENT}
          state={game}
          dispatch={dispatch}
          onExit={exitToLobby}
          onPlayAgain={() => {
            abandonSave();
            setGame(null);
          }}
          pushToast={pushToast}
        />
      ) : (
        <Lobby
          content={BASE_CONTENT}
          hasSave={hasSave}
          onStart={startGame}
          onResume={resumeGame}
          onAbandonSave={abandonSave}
        />
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      <div className="phone-gate">
        <div style={{ fontSize: '3rem' }}>🎡</div>
        <h1>Brighton Beach</h1>
        <p>
          The seafront needs a bit more room — Brighton Beach plays best on a tablet or larger
          screen. Rotate your device or find a bigger window and the tide will come in.
        </p>
      </div>
    </>
  );
}
