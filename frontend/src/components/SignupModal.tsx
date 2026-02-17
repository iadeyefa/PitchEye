import React, { useState } from "react";
import { useAuth } from "../AuthContext";
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

const enterUser = async (firstName: string, lastName: string, email: string, role: string, teamID: string,userId?: string) => {
    try {
    const response = await fetch('http://localhost:8000/api/users/create_user/', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({userId, firstName, lastName, email, role, teamID}), 
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json(); 
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

const enterTeam = async (teamName: string, adminID?: string) => {
    try {
    const response = await fetch('http://localhost:8000/api/teams/create_team/', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({teamName, adminID}), 
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json(); // Parse response as JSON
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

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
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [teamId, setTeamId] = useState("");
  const { signup } = useAuth();

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

    if (role === 'admin' && !teamName) {
      setError("Please enter a team name");
      return;
    }

    if (role === 'member') {
      if (!teamCode)
      {setError("Please enter a team code");
      return;}
      const data = await checkTeamCode(teamCode);
      if (!data || data.length === 0) { setError("Team does not exist"); return; }
      setTeamId(data[0]['id'])  
    }

    setLoading(true);
    try {
      const userId = await signup(email, password);

      // for both: send name, email, role, team_id to api/users/create_user
      // TODO: save the id from this, use it for enterTeam
      enterUser(firstName,lastName, email, role, teamId, userId)
      // for admin: send team name, admin_id to api/teams/create_team
      if(role=='admin') await enterTeam(teamName, userId)
      setEmail("");
      setPassword("");
      setConfirmPassword("");
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

      <div>
        <p>Please select your role:</p>
        <input
          type="radio"
          id="member"
          name="role"
          value="member"
          onChange={() => setRole('member')}
        />
        <label htmlFor="member">member</label><br/>
        <input
          type="radio"
          id="admin"
          name="role"
          value="admin"
          onChange={() => setRole('admin')}
        />
        <label htmlFor="admin">admin</label><br/>

      {role === 'admin' && (
        <input type="text" placeholder="team name" onChange={(e) => setTeamName(e.target.value)} />
      )}
      {role === 'member' && (
        <input type="text" placeholder="team code" onChange={(e) => setTeamCode(e.target.value)} />
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
