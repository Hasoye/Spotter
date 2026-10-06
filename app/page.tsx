import type { Metadata } from "next";
import Link from "next/link";
import LandingNav from "../components/LandingNav";
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

export default function LandingPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const view = searchParams?.view;

  if (view === "privacy") {
    return <PrivacyPolicyView />;
  }

  if (view === "terms") {
    return <TermsOfServiceView />;
  }

  return (
    <div className="landingPage">
      <header className="heroWrapper">
        <div className="heroBackground" aria-hidden="true">
          <video
            className="heroVideo"
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-fallback.jpg"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          <div className="heroOverlay" />
        </div>

        <LandingNav />

        <section className="heroSection" aria-label="Introduction">
          <h1 className="heroHeading">
            Your Gym, <span className="heroHeadingAccent">One Tap Away</span>
          </h1>
          <p className="heroSubtext">
            Check in by QR code, ask about your balance or gym rules,
            and pay or renew, all from your phone.
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
      </header>

      <div className="featuresSectionWrapper">
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
      </div>

      <footer className="landingFooter" aria-label="Site Footer">
        <div className="landingFooterContent">
          <p className="footerText">
            © 2026 Spotter. Built for members of the gym.
          </p>
          <div className="footerLinks">
            <Link href="/?view=privacy" className="footerText footerLink">Privacy Policy</Link>
            <span className="footerText footerDot" aria-hidden="true">·</span>
            <Link href="/?view=terms" className="footerText footerLink">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PrivacyPolicyView() {
  return (
    <div className="legalPage">
      <div className="legalHeader">
        <Link href="/" className="legalBackLink" aria-label="Back to Home">
          &larr; Back to Home
        </Link>
        <h1 className="legalTitle">Privacy Policy</h1>
        <p className="legalLastUpdated">Last Updated: October 6, 2026</p>
      </div>

      <div className="legalContent">
        <p>
          Welcome to Spotter. We respect your privacy and are committed to
          protecting your personal data. This privacy policy will inform you as
          to how we look after your personal data when you use the Spotter
          application and tell you about your privacy rights and how the law
          protects you, in compliance with the Nigeria Data Protection Act
          (NDPA) 2023 and the Nigeria Data Protection Regulation (NDPR).
        </p>

        <h2>1. The Data We Collect About You</h2>
        <p>
          Spotter is a member-facing app for our gym members. We may collect,
          use, store, and transfer different kinds of personal data about you
          which we have grouped together as follows:
        </p>
        <ul>
          <li>
            <strong>Identity Data:</strong> includes your member ID, first name,
            last name, and tier status (Basic or Premium).
          </li>
          <li>
            <strong>Contact Data:</strong> includes your phone number used for
            SMS OTP login.
          </li>
          <li>
            <strong>Financial Data:</strong> includes your payment history,
            current balance, and expiry date. We do not store your credit card
            details. All payments are processed securely by our payment gateway,
            Flutterwave.
          </li>
          <li>
            <strong>Usage Data:</strong> includes your gym attendance records
            and check-in logs via QR code scanning.
          </li>
        </ul>

        <h2>2. How We Use Your Personal Data</h2>
        <p>
          We will only use your personal data when the law allows us to. Most
          commonly, we will use your personal data in the following
          circumstances:
        </p>
        <ul>
          <li>To verify your identity during login via SMS OTP.</li>
          <li>
            To manage your gym membership, including processing renewals and
            payments through Flutterwave.
          </li>
          <li>
            To allow you to retrieve your private records (such as attendance,
            balance, and expiry) and answer your queries using our internal
            system.
          </li>
          <li>To process gym check-ins via QR code.</li>
        </ul>

        <h2>3. Data Security</h2>
        <p>
          We have put in place appropriate security measures to prevent your
          personal data from being accidentally lost, used, or accessed in an
          unauthorized way, altered, or disclosed. Your private records are
          fetched by exact member ID only and are never searched across other
          members' data.
        </p>

        <h2>4. Your Legal Rights</h2>
        <p>
          Under the NDPA and NDPR, you have rights under data protection laws in
          relation to your personal data, including the right to request access,
          correction, erasure, restriction, transfer, to object to processing,
          and to withdraw consent. If you wish to exercise any of these rights,
          please speak to our on-duty staff at the gym.
        </p>
      </div>
    </div>
  );
}

function TermsOfServiceView() {
  return (
    <div className="legalPage">
      <div className="legalHeader">
        <Link href="/" className="legalBackLink" aria-label="Back to Home">
          &larr; Back to Home
        </Link>
        <h1 className="legalTitle">Terms of Service</h1>
        <p className="legalLastUpdated">Last Updated: October 6, 2026</p>
      </div>

      <div className="legalContent">
        <p>
          Welcome to Spotter. These Terms of Service govern your use of the
          Spotter application, provided to you as a member of our gym. By logging
          in and using the app, you agree to these terms.
        </p>

        <h2>1. App Usage and Scope</h2>
        <p>
          Spotter is a retrieval-only application designed to provide you with
          information from the gym's records. You can use the app to check in by
          QR code, ask questions regarding gym rules or your private records
          (like balance and expiry), and pay or renew your membership. The app
          does not allow class booking, reservation, or social features.
        </p>

        <h2>2. Account Access and Authentication</h2>
        <p>
          Access to Spotter is restricted to registered gym members. You must
          authenticate using a One-Time Password (OTP) sent via SMS to the phone
          number associated with your gym record. You are responsible for
          maintaining the confidentiality of your OTP and device.
        </p>

        <h2>3. Payments and Renewals</h2>
        <p>
          You may pay or renew your membership through the app via our secure
          payment gateway, Flutterwave. Please note that your balance and expiry
          status will only be updated upon official server confirmation from the
          payment gateway. Spotter does not process refunds or resolve billing
          disputes directly within the app; such issues must be routed to our
          on-duty staff.
        </p>

        <h2>4. Tiers and Content Access</h2>
        <p>
          Spotter provides content based on your membership tier (Basic or
          Premium). Basic members have access to the timetable, prices, rules,
          access hours, and personal attendance and balance. Premium members
          additionally have access to written training plans. If your membership
          expires, you will lose access to shared content until you renew,
          though you will retain access to your payment history and renewal
          options.
        </p>

        <h2>5. Automated Assistance Limitations</h2>
        <p>
          Spotter uses automated systems to answer your queries based strictly on
          existing gym records. The app will refuse to answer questions if it
          cannot find a highly confident match in the records or if the question
          relates to sensitive staff-routed categories (such as medical guidance,
          refunds, or exceptions). You can always flag a wrong answer using the
          in-app controls.
        </p>
      </div>
    </div>
  );
}
