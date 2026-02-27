import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/CreateGame.css";

type Game = {
    id: number;
    title: string;
    session_code: string;
    qr_code_url: string | { signedURL?: string; signed_url?: string };
    game_time: string;
};

export default function CreateGame() {

}