import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/LiveFeed.css";
import { supabase } from "../supabaseClient";

type GameProps = {
  id: number;
  title: string;
  session_code: string;
  qr_code_url: string;
  game_time: string;
};
 
type LiveStream = {
  id: number;
  streamUrl?: string;
  currentGame: GameProps;
};

// TODO update livevideo card with video playback
function LiveVideoCard({ stream }: { stream: LiveStream }) {
  return (
    <div className="lf-card">
      <div className="lf-video-wrapper">
        {stream.streamUrl ? (
          <video
            className="lf-video"
            src={stream.streamUrl}
            autoPlay
            muted
            playsInline
          />
        ) : (
          // skeleton placeholder until stream url exists
          <div className="lf-placeholder">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="lf-thumb-icon"
            >
              <rect x="2" y="4" width="15" height="16" rx="2" />
              <path d="M17 9l5-3v12l-5-3V9z" />
            </svg>
          </div>
        )}
        <span className="lf-live-badge">● LIVE</span>
      </div>
    </div>
  );
}


export default function LiveFeed() {
  const { sessionCode } = useParams<{ sessionCode?: string }>(); 
  const [game, setGame] = useState<GameProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    const fetchGame = async () => {
      try {
        if (!supabase) throw new Error("Supabase not initialized");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
 
        const headers = { Authorization: `Bearer ${session.access_token}` };
 
        if (sessionCode) {
          // joined via QR → fetch by session code
          const res = await fetch(`http://localhost:8000/api/games/session/${sessionCode}/`, { headers });
          if (!res.ok) throw new Error("Session not found");
          const data: GameProps = await res.json();
          setGame(data);
        } else {
          // viewer clicked Live tab : find ongoing session for their team
          const res = await fetch("http://localhost:8000/api/games/join/", { headers });
          if (res.status === 404) {
            setGame(null); // no live session right now, not an error
            return;
          }
          if (!res.ok) throw new Error("Failed to load live session");
          const data = await res.json();
          setGame(data.game[0]);
        }
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
 
    fetchGame();
  }, [sessionCode]);
 

  if (loading) return <div className="lf-container"><div className="lf-inner"><p className="lf-state-msg">Loading...</p></div></div>;
  if (error)   return <div className="lf-container"><div className="lf-inner"><p className="lf-state-msg lf-state-msg--error">{error}</p></div></div>;
  if (!game)   return <div className="lf-container"><div className="lf-inner"><p className="lf-state-msg">No live session right now.</p></div></div>;
  return (
    <div className="lf-container">
        <h1 className="lf-title">{game.title}</h1> 
        <div className="lf-feed">
        <p className="lf-game-time">
          {new Date(game.game_time).toLocaleDateString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
          })}
        </p>
            <LiveVideoCard stream={{id: 1, currentGame: game}} />
        </div>
    </div>
  );
}
 
 
