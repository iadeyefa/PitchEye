import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient"
import "../styles/ProfilePage.css"
import { useAuth } from "../AuthContext"

type UserRole = 'Admin' | 'User';

type ProfileProps = {
    id: number;
    email: string;
    password: string;
    role: UserRole
}

export default function Profile() {
    const { user } = useAuth();
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [games, setGames] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const getToken = async () => {
        if (!supabase) throw new Error("Supabase not initialized");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        return session.access_token;
    };

    useEffect(() => {
        retrieveGames();
    }, []);

    const retrieveGames = async () => {
        try {
            const token = await getToken();
            const response = await fetch("http://localhost:8000/api/games/", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();
            setGames(data);
        }
        catch (error: unknown) {
            setError((error as Error).message || "Unable to fetch user games");
        } finally {
            setLoading(false);
        }
    }

    const handleChangeEmail = async () => {

    }

    const handleChangePassword = async () => {

    }

    return (
        <div className="p-container">
            <div className="p-card">
                <h1>Profile</h1>
                <h2 className="p-title">Email: {user?.email}</h2>
            </div>
        </div>
    )
}