import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";

export const metadata: Metadata = {
  title: "Spotter — Your Gym, One Tap Away",
  description: "Gym member retrieval portal",
  openGraph: {
    title: "Spotter — Your Gym, One Tap Away",
    description: "Gym member retrieval portal",
    url: "https://spottergym.com",
    siteName: "Spotter",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Spotter Gym Member Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotter — Your Gym, One Tap Away",
    description: "Gym member retrieval portal",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://spottergym.com",
  },
};

const FEATURES = [
  {
    icon: "📱",
    title: "QR Code Check-In",
    description:
      "Scan the QR code at the front desk to log your visit. No buttons, no guesswork — just scan and go.",
  },
  {
    icon: "💬",
    title: "Ask Spotter Anything",
    description:
      "Ask about gym hours, rules, guest policies, or your own balance and attendance — answered from real records.",
  },
  {
    icon: "💳",
    title: "Pay & Renew",
    description:
      "Renew your membership or settle your balance securely through the payment gateway, right from the app.",
  },
  {
    icon: "🏋️",
    title: "Training Plans",
    description:
      "Premium members get access to written training plans prepared by the gym's trainers.",
  },
  {
    icon: "🔒",
    title: "SMS OTP Login",
    description:
      "Your account is secured with a one-time code sent to your registered phone number — no password needed.",
  },
  {
    icon: "🚩",
    title: "Flag Wrong Answers",
    description:
      "If something does not look right, flag it instantly. Every flag reaches the gym owner for review.",
  },
];

export default function LandingPage() {
  return (
    <div className="landingPage">
      <nav className="landingNav" aria-label="Main navigation">
        <span className="landingNavBrand">SPOTTER</span>
        <div className="landingNavActions">
          <Link href="/login" className="navLinkSecondary" id="nav-login">
            Log In
          </Link>
          <Link href="/signup" className="navLinkPrimary" id="nav-signup">
            Sign Up
          </Link>
        </div>
      </nav>

      <section className="heroSection" aria-label="Introduction">
        <span className="heroBadge">Member Portal</span>
        <h1 className="heroHeading">
          Your Gym, <span className="heroHeadingAccent">One Tap Away</span>
        </h1>
        <p className="heroSubtext">
          Check in by QR code, ask about your balance or gym rules, and pay or
          renew — all from your phone.
        </p>
        <div className="heroActions">
          <Link
            href="/signup"
            className="heroActionPrimary"
            id="hero-signup"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="heroActionSecondary"
            id="hero-login"
          >
            Already a Member? Log In
          </Link>
        </div>
      </section>

      <section className="featuresSection" aria-label="Features">
        <h2 className="featuresSectionTitle">
          Everything you need, nothing you don&apos;t
        </h2>
        <div className="featuresGrid">
          {FEATURES.map((feature) => (
            <article className="featureCard" key={feature.title}>
              <div className="featureIcon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="featureTitle">{feature.title}</h3>
              <p className="featureDesc">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landingFooter">
        <p className="footerText">
          © {new Date().getFullYear()} Spotter. Built for members of the gym.
        </p>
      </footer>
    </div>
  );
}
