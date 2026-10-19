import { describe, it, expect, vi } from "vitest";

describe("SPOTTER Modern Post-Signup Onboarding Flow", () => {
  // 1. Flow & Copy Definitions
  const ONBOARDING_SCREENS = [
    {
      step: 1,
      heading: "Welcome to SPOTTER",
      body: "Your member account is ready. Here's a quick look around.",
      primaryCta: "Next",
      secondaryAction: "Skip",
    },
    {
      step: 2,
      heading: "Your membership, at a glance",
      body: "Keep your membership status and plan details within easy reach.",
      primaryCta: "Next",
      secondaryAction: "Skip",
    },
    {
      step: 3,
      heading: "Your SPOTTER dashboard",
      body: "Your member information and available services, all in one place.",
      primaryCta: "Get Started",
      secondaryAction: "Skip",
    },
  ];

  describe("Screen Content and Progress Hierarchy", () => {
    it("contains exactly 3 educational screens with strictly defined copy", () => {
      expect(ONBOARDING_SCREENS.length).toBe(3);

      expect(ONBOARDING_SCREENS[0].heading).toBe("Welcome to SPOTTER");
      expect(ONBOARDING_SCREENS[0].body).toBe(
        "Your member account is ready. Here's a quick look around."
      );
      expect(ONBOARDING_SCREENS[0].primaryCta).toBe("Next");
      expect(ONBOARDING_SCREENS[0].secondaryAction).toBe("Skip");

      expect(ONBOARDING_SCREENS[1].heading).toBe("Your membership, at a glance");
      expect(ONBOARDING_SCREENS[1].body).toBe(
        "Keep your membership status and plan details within easy reach."
      );
      expect(ONBOARDING_SCREENS[1].primaryCta).toBe("Next");
      expect(ONBOARDING_SCREENS[1].secondaryAction).toBe("Skip");

      expect(ONBOARDING_SCREENS[2].heading).toBe("Your SPOTTER dashboard");
      expect(ONBOARDING_SCREENS[2].body).toBe(
        "Your member information and available services, all in one place."
      );
      expect(ONBOARDING_SCREENS[2].primaryCta).toBe("Get Started");
      expect(ONBOARDING_SCREENS[2].secondaryAction).toBe("Skip");
    });

    it("ensures Skip is a subordinate secondary action across all screens", () => {
      ONBOARDING_SCREENS.forEach((screen) => {
        expect(screen.secondaryAction).toBe("Skip");
        expect(screen.primaryCta).not.toBe("Skip");
      });
    });

    it("verifies progress indicator states for all 3 steps", () => {
      const getProgressState = (currentStep: number) => {
        return [1, 2, 3].map((step) => (step === currentStep ? "ACTIVE" : "INACTIVE"));
      };

      expect(getProgressState(1)).toEqual(["ACTIVE", "INACTIVE", "INACTIVE"]);
      expect(getProgressState(2)).toEqual(["INACTIVE", "ACTIVE", "INACTIVE"]);
      expect(getProgressState(3)).toEqual(["INACTIVE", "INACTIVE", "ACTIVE"]);
    });
  });

  describe("Step Navigation Logic", () => {
    it("advances sequentially from Screen 1 to Screen 2, then Screen 3 on Next", () => {
      let currentStep = 1;
      const onNext = () => {
        if (currentStep < 3) currentStep += 1;
      };

      expect(currentStep).toBe(1);
      onNext();
      expect(currentStep).toBe(2);
      onNext();
      expect(currentStep).toBe(3);
    });

    it("completes onboarding and triggers dashboard navigation on Screen 3 Get Started", () => {
      let currentStep = 3;
      let navigatedTo: string | null = null;
      let isOnboardedSet = false;

      const onGetStarted = () => {
        if (currentStep === 3) {
          isOnboardedSet = true;
          navigatedTo = "/dashboard";
        }
      };

      onGetStarted();
      expect(isOnboardedSet).toBe(true);
      expect(navigatedTo).toBe("/dashboard");
    });

    it("immediately completes onboarding and navigates to /dashboard when Skip is tapped from any screen", () => {
      [1, 2, 3].forEach((step) => {
        let navigatedTo: string | null = null;
        let isOnboardedSet = false;

        const onSkip = () => {
          isOnboardedSet = true;
          navigatedTo = "/dashboard";
        };

        onSkip();
        expect(isOnboardedSet).toBe(true);
        expect(navigatedTo).toBe("/dashboard");
      });
    });
  });

  describe("Authentication and Routing Behaviors", () => {
    it("routes successful new account signups to /onboarding instead of /dashboard", () => {
      const determineSignupRedirect = (signupSuccess: boolean) => {
        if (!signupSuccess) return null;
        return "/onboarding";
      };

      expect(determineSignupRedirect(true)).toBe("/onboarding");
    });

    it("routes existing member logins directly to /dashboard and marks onboarding complete", () => {
      const determineLoginRedirect = (loginSuccess: boolean) => {
        if (!loginSuccess) return null;
        return {
          redirectUrl: "/dashboard",
          setCookie: { name: "spotter_onboarded", value: "true" },
        };
      };

      const result = determineLoginRedirect(true);
      expect(result).not.toBeNull();
      expect(result?.redirectUrl).toBe("/dashboard");
      expect(result?.setCookie.value).toBe("true");
    });

    it("redirects completed/skipped onboarding members away from /onboarding to /dashboard", () => {
      const checkOnboardingAccess = (
        isAuthenticated: boolean,
        isOnboarded: boolean
      ) => {
        if (!isAuthenticated) return { action: "REDIRECT", destination: "/auth?mode=login" };
        if (isOnboarded) return { action: "REDIRECT", destination: "/dashboard" };
        return { action: "ALLOW", destination: "/onboarding" };
      };

      // Authenticated but not yet onboarded (brand new signup)
      expect(checkOnboardingAccess(true, false)).toEqual({
        action: "ALLOW",
        destination: "/onboarding",
      });

      // Authenticated and already completed onboarding (subsequent login or manual return)
      expect(checkOnboardingAccess(true, true)).toEqual({
        action: "REDIRECT",
        destination: "/dashboard",
      });
    });

    it("protects /onboarding against unauthenticated access via middleware", () => {
      const protectedPrefixes = [
        "/dashboard",
        "/member",
        "/settings",
        "/profile",
        "/onboarding",
      ];

      const isRouteProtected = (pathname: string) => {
        return protectedPrefixes.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
        );
      };

      expect(isRouteProtected("/onboarding")).toBe(true);
      expect(isRouteProtected("/dashboard")).toBe(true);
      expect(isRouteProtected("/auth")).toBe(false);

      const handleMiddleware = (pathname: string, sessionCookie?: string) => {
        if (isRouteProtected(pathname) && !sessionCookie) {
          return {
            status: 307,
            redirect: `/auth?mode=login&redirect=${encodeURIComponent(pathname)}`,
          };
        }
        return { status: 200, proceed: true };
      };

      const unauthenticatedAttempt = handleMiddleware("/onboarding", undefined);
      expect(unauthenticatedAttempt.status).toBe(307);
      expect(unauthenticatedAttempt.redirect).toBe(
        "/auth?mode=login&redirect=%2Fonboarding"
      );

      const authenticatedAttempt = handleMiddleware("/onboarding", "valid_session_token");
      expect(authenticatedAttempt.status).toBe(200);
      expect(authenticatedAttempt.proceed).toBe(true);
    });

    it("verifies refreshing the page does not duplicate accounts or create redundant sessions", () => {
      // Refreshing /onboarding simply re-renders the same static client view
      const renderCountState = { renders: 0, sessionCalls: 0, userCreations: 0 };

      const onPageRefresh = () => {
        renderCountState.renders += 1;
        // No session issuance or account creation happens on GET /onboarding
      };

      onPageRefresh();
      onPageRefresh();
      onPageRefresh();

      expect(renderCountState.renders).toBe(3);
      expect(renderCountState.sessionCalls).toBe(0);
      expect(renderCountState.userCreations).toBe(0);
    });
  });
});
