import { use, useState } from "react"
import { Link } from "react-router-dom"
import '../styles/Navbar.css'

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <nav className="navbar">
            <button type="button" title='hamburger' className="hamburger" onClick={() => setIsOpen(!isOpen)}>
                <span/>
                <span/>
                <span/>
                <span/>
            </button>
            <ul className={`nav-links ${isOpen ? "open" : ""}`}>
                <li><Link to="/" onClick={() => setIsOpen(false)}>Home</Link></li>
                <li><Link to="/live" onClick={() => setIsOpen(false)}>Live</Link></li>
                <li><Link to="/upload" onClick={() => setIsOpen(false)}>Upload</Link></li>
                <li><Link to="/profile" onClick={() => setIsOpen(false)}>Profile</Link></li>
            </ul>
        </nav>
    )
}