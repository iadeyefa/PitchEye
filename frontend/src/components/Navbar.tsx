import { useState } from 'react';
import { Link } from "react-router-dom"
import ActionModal from "./ActionModal"
import '../styles/Navbar.css'

export default function Navbar() {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
        <nav className="desktop-nav">
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/live">Live</Link></li>
                <li><button className="plus-btn" onClick={() => setModalOpen(true)}>
                    +
                </button></li>
                <li><Link to="/profile">Profile</Link></li>
            </ul>
        </nav>
        <nav className="mobile-nav">
            <Link to="/">Home</Link>
            <Link to="/live">Live</Link>
            <button className="plus-btn" onClick={() => setModalOpen(true)} aria-label="Create">
                +
            </button>
            <Link to="/profile">Profile</Link>
        </nav>

        <ActionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    )
}