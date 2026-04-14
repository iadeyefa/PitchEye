import React, { useState } from "react";

import { supabase } from "../supabaseClient";
import "../styles/SignupModal.css";

type SignupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSignupSuccess: () => void;
};

// we need to verify if the team code exists if role=member
const checkTeamCode = async (code: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/teams/get_team/?code=${code}`, {
        method: 'GET',
      });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json(); }
    catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

const enterUser = async (firstName: string, lastName: string, email: string, role: string, team_id: string, userId?: string) => {
  const response = await fetch('http://localhost:8000/api/users/create_user/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, firstName, lastName, email, role, team_id }),
  });
  if (!response.ok) throw new Error('Failed to create user profile');
  return response.json();
};

const enterTeam = async (teamName: string, token: string) => {
  const response = await fetch('http://localhost:8000/api/teams/create_team/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ team_name: teamName }),
  });
  if (!response.ok) throw new Error('Failed to create team');
  return response.json();
};

export default function SignupModal({
  isOpen,
  onClose,
  onSignupSuccess,
}: SignupModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('');
  const [teamAction, setTeamAction] = useState<'join' | 'create'>('join');
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const canCreateTeam = role === "admin" || role === "coach";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!role) {
      setError("Please select a role");
      return;
    }

    if (canCreateTeam && teamAction === 'create' && !teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    let resolvedTeamId = '';
    if (!canCreateTeam || teamAction === 'join') {
      if (!teamCode) { setError("Please enter a team code"); return; }
      const data = await checkTeamCode(teamCode);
      if (!data || data.length === 0) { setError("Team does not exist"); return; }
      resolvedTeamId = data[0]['id'];
    }

    setLoading(true);
    try {
      // Sign up directly to capture the session token immediately
      const { data: authData, error: authError } = await supabase!.auth.signUp({ email, password });
      if (authError) throw authError;

      const userId = authData.user?.id;
      const token = authData.session?.access_token ?? '';

      // Create profile first — create_team requires the profile to exist with the correct role
      await enterUser(firstName, lastName, email, role, resolvedTeamId, userId);

      if (canCreateTeam && teamAction === 'create') {
        // Profile now exists with the correct leadership role, so the backend can create and attach a team.
        await enterTeam(teamName.trim(), token);
      }

      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("");
      setTeamAction("join");
      setTeamName("");
      setTeamCode("");
      onSignupSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Create Account</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signup-email">Email:</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password:</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password:</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Please select your role:</label>
            <select
              title='role-select'
              onChange={(e) => {
                const nextRole = e.target.value;
                setRole(nextRole);
                setTeamAction(nextRole === "admin" || nextRole === "coach" ? "create" : "join");
                setTeamName("");
                setTeamCode("");
              }}
              value={role}
            >
              <option value="">-- Select a Role --</option>
              <option value="admin">Admin</option>
              <option value="coach">Coach</option>
              <option value="player">Player</option>
              <option value="parent">Parent</option>
              <option value="viewer">Viewer</option>
            </select>
            {canCreateTeam && (
              <div className="signup-team-choice">
                <button
                  type="button"
                  className={`signup-team-choice-btn ${teamAction === "create" ? "signup-team-choice-btn--active" : ""}`}
                  onClick={() => setTeamAction("create")}
                  disabled={loading}
                >
                  Create Team
                </button>
                <button
                  type="button"
                  className={`signup-team-choice-btn ${teamAction === "join" ? "signup-team-choice-btn--active" : ""}`}
                  onClick={() => setTeamAction("join")}
                  disabled={loading}
                >
                  Join Team
                </button>
              </div>
            )}
            {role && (!canCreateTeam || teamAction === 'join') && (
              <input
                type="text"
                placeholder="Team Code"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                disabled={loading}
              />
            )}
            {canCreateTeam && teamAction === 'create' && (
              <input
                type="text"
                placeholder="Team Name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={loading}
              />
            )}
          </div>
          <button
            type="submit"
            className="signup-btn"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
