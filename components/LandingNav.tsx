"use client";

import Link from "next/link";
import { useState } from "react";

export default function LandingNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="landingNav" aria-label="Main navigation">
      <Link href="/" className="landingNavBrandLink" aria-label="Spotter Home">
        <img src="/icon.svg" alt="SPOTTER" width="32" height="32" className="landingNavBrand" />
      </Link>
      
      <button 
        className="hamburgerMenu" 
        onClick={() => setIsMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
        aria-controls="landingNavActions"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div id="landingNavActions" className={`landingNavActions ${isMenuOpen ? 'open' : ''}`}>
        <button 
          className="mobileMenuClose" 
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <Link href="/login" className="navLinkSecondary" id="nav-login" onClick={() => setIsMenuOpen(false)}>
          Log In
        </Link>
        <Link href="/signup" className="navLinkPrimary" id="nav-signup" onClick={() => setIsMenuOpen(false)}>
          Sign Up
        </Link>
      </div>
    </nav>
  );
}
