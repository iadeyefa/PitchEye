import { Link } from "react-router-dom"
import '../styles/Navbar.css'

export default function Navbar() {
    return (
        <>
        <nav className="desktop-nav">
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/live">Live</Link></li>
                <li><Link to="/upload">Upload</Link></li>
                <li><Link to="/profile">Profile</Link></li>
            </ul>
        </nav>
        <nav className="mobile-nav">
                <Link to="/">Home</Link>
                <Link to="/live">Live</Link>
                <Link to="/upload">Upload</Link>
                <Link to="/profile">Profile</Link>
        </nav>
        </>
    )
}