---
title: "One Hour Before Submission, the Login Never Came Back to the App — MESH Hackathon VoDa Retrospective"
description: "At the 2026 MESH <The Limits> Hackathon, our volunteer-matching app 'VoDa' took 3rd place. Here's how I ripped out the whole login flow and rebuilt it with Google sign-in — and got stuck, one hour before submission, on an auth that finished but never returned to the app."
author: "Seoyoon"
pubDate: 2026-07-01
isDraft: false
linkedContent: "mesh-hackathon-voda"

image: "@blogImages/mesh-hackathon-banner.jpg"
imageAlt: "2026 MESH Hackathon <The Limits> event banner"
---

## One Hour Before Submission

The Google account picker came up just fine. I chose an account, tapped through the consent screen — and there the app froze. The Chrome Custom Tab sat on the "authentication complete" screen and never handed control back to our app. Pressing back did nothing. We had a little over an hour left before submission.

That was the start of the 30 minutes I spent stuck the longest at the 2026 MESH Hackathon. To skip to the ending: we submitted in time, and our team took **3rd place (₩100,000 prize)**.

![2026 MESH Hackathon 3rd place](../images/mesh-hackathon-award.jpg)

## What Kind of Hackathon It Was

**2026 MESH \<The Limits\> Hackathon × AWS**, held at Chung-Ang University on June 27–28, 2026. The slogan was "It doesn't have to be perfect — just dive in and try." After a day and a half, I couldn't think of a more accurate description.

Our team had seven people: 1 PM, 3 backend, 3 frontend. What we built was **VoDa** — an AI-powered volunteer-matching Android app that helps you find volunteer opportunities quickly and easily.

- **Stack**: Kotlin, Jetpack Compose + Material3, MVVM + Clean Architecture, Hilt (DI), Navigation Compose, Retrofit2 + OkHttp3, Coil
- **Screens**: Onboarding → Login → Home / Search / Saved / My Activity / My Page (bottom navigation)
- **Collaboration**: `main` (release) ← `dev` (integration) ← `feature/*` branches. The three frontend members split the screens — onboarding·login / home·search / saved·activity — and merged after PR review.

Honestly, the schedule was tight the whole way through. The backend work took much longer than expected, and by the time the API was ready enough to actually connect the frontend to it, we had only an hour left before submission. I'd had way too much caffeine to stay awake through the night, so my stomach was off the entire time — and that was the condition I pushed through the final integration in.

## My Part — Ripping Out the Whole Login Flow

Login was actually the last piece I touched in this hackathon. Up until then I'd been building the **Home, Search, and Map screens** — the Home that lists volunteer opportunities, the Search that filters them by criteria, and the Map that shows activity locations on a map. Once the backend connection became possible only an hour before submission, that's when I got my hands on the login that was still a mock, and swapped it out for a real **Google social login**.

The existing code had an email/password mock login form. My job was to replace it with a Google social login that actually worked and wire it up to the backend auth API.

### Why Credential Manager

There are two ways to add Google login on Android: the long-standing `GoogleSignInClient`, and the newer `androidx.credentials` (Credential Manager). I went with the latter, and three reasons lined up.

- The legacy `GoogleSignInClient` is already deprecated — writing something new, there was no reason to bet on the losing side.
- One Tap UX — I wanted to put the flow that shows already-signed-in accounts in a single tap right at the front as the primary entry point.
- The future direction pointed to Credential Manager as the right answer anyway.

### A Two-Stage Login Strategy

So I designed login in two stages. The first shows accounts already on the device in a single tap; if that fails, it falls back to the full login UI where you can also add a new account.

```kotlin
// Stage 1: already-saved accounts via One Tap
val googleIdOption = GetGoogleIdOption.Builder()
    .setServerClientId(webClientId)
    .setFilterByAuthorizedAccounts(false)
    .build()

try {
    val result = credentialManager.getCredential(context, request(googleIdOption))
    return extractIdToken(result)
} catch (e: GetCredentialCancellationException) {
    // User explicitly cancelled — stop here. Do NOT retry with stage 2.
    throw e
} catch (e: GetCredentialException) {
    // Any other failure → fall through to stage 2
}

// Stage 2: full login UI that also allows adding a new account
val signInOption = GetSignInWithGoogleOption.Builder(webClientId).build()
val result = credentialManager.getCredential(context, request(signInOption))
return extractIdToken(result)
```

The one thing I was careful about here was **distinguishing cancellation from failure**. If you route the case where the user explicitly hits "cancel" in the account picker (`GetCredentialCancellationException`) into the stage-2 fallback too, you get the annoying UX of the login sheet popping up again right after they cancelled. So I let that one exception bypass the fallback and terminate immediately.

### And Then, the 30 Minutes It Wouldn't Return to the App

After wiring up the two-stage fallback, I ran it — and that's exactly when the symptom hit. The account picker and consent screen showed up, but once authentication finished it couldn't return to the app and just froze in the Chrome Custom Tab.

Narrowing down the cause, here's what was happening. When the Credential Manager login falls back to a web flow, a Chrome Custom Tab opens, and after auth completes it sends a redirect back to the app on a custom scheme, `com.googleusercontent.apps.518317720365-...`. But **there was no intent-filter in the app to receive that redirect.** I simply hadn't built the door for it to come back through — so even when auth succeeded, there was no path for that result to enter the app.

The fix was to add an intent-filter that receives that scheme to `MainActivity` in `AndroidManifest.xml`.

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.googleusercontent.apps.518317720365-..." />
</intent-filter>
```

I also set `MainActivity`'s `launchMode` to `singleTop`. When the redirect comes back, this makes it return to the existing activity instance instead of spinning up a brand-new one on top.

The thing is, I was stuck on this with less than an hour left before submission, and it took over 30 minutes to find the cause and fix it. The auth logic itself was fine — it was realizing there was no "door to come back through" that took so long. I still remember the relief when the login finally popped back into the app.

### Things That Drifted While Working Alongside the Backend

In a hackathon where frontend and backend run at the same time, the spec shifts under your feet.

- `AuthRepository.loginWithGoogle(idToken)` passes the idToken to the backend `/social-login`, gets a JWT back, and stores it in DataStore. I used the `isNewUser` flag in the response to branch — new users to onboarding, existing users to home.
- Then at some point the app just stopped working. Digging in, the backend response field name had changed from `accessToken` to `token`. I re-synced the DTO (`SocialLoginData`) to fix it — and this flow of "the app dies → turns out the spec had changed" repeated throughout the hackathon.
- The API server address also had to move mid-way, from Railway to Render.

### Hiding a Hackathon-Only Convenience Feature Safely

When login is tied to real Google auth, everyone else working on other screens has to go through login every single time they test. On a tight schedule, that's pure waste. So I built a "paste token directly" dialog (`saveDevToken`) that only appears when `BuildConfig.DEBUG` is true. Paste in a JWT issued from Swagger and you jump straight to Home without a real login.

The key was **hiding it behind a `BuildConfig.DEBUG` guard**. In a release build it's code that doesn't exist at all, so there's no worry about the convenience feature leaking into production. It was the point where I compromised between the hackathon's "just move fast" spirit and a minimal safety net.

## Config Change Notes

- `build.gradle.kts`: enabled `buildConfig = true`, added the three Credential Manager dependencies (`androidx-credentials`, `androidx-credentials-play-services`, `google-identity-googleid`)
- `AndroidManifest.xml`: added the custom-scheme intent-filter above + set `launchMode="singleTop"` on `MainActivity`
- `LoginScreen`/`ViewModel`: stripped out all the email/password state and validation logic, simplified to a single Google login flow. Added a `CircularProgressIndicator` while loading and an error-message UI

## Wrapping Up

Ripping out the entire login flow and rebuilding it a new way within a day and a half was a nerve-wracking choice — and at the worst possible timing, with the backend connection only starting an hour before submission. But once the app's front door, authentication, stood on solid ground, everyone working on the other screens could focus on their own part on top of it.

Looking back, what I learned was less about any one piece of tech and more a feel for "building the door to come back through." Whether it's an OAuth redirect or parallel development, wiring up only the success path gets you halfway there — and halfway doesn't work. Just like the slogan said, "it doesn't have to be perfect, just dive in and try," I think building something that runs all the way through — before polishing it — is what led to 3rd place in the end.
