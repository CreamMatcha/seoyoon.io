---
title: "제출 1시간 전, 로그인이 앱으로 돌아오지 않았다 — MESH 해커톤 VoDa 회고"
description: "2026 MESH <The Limits> 해커톤에서 봉사 매칭 앱 'VoDa'로 3등을 했다. 로그인 플로우를 통째로 Google 소셜 로그인으로 갈아엎다가, 제출 한 시간 전에 인증 후 앱으로 돌아오지 못하는 문제에 발목 잡혔던 이야기."
author: "Seoyoon"
pubDate: 2026-07-01
isDraft: false
linkedContent: "mesh-hackathon-voda"

image: "@blogImages/mesh-hackathon-banner.jpg"
imageAlt: "2026 MESH Hackathon <The Limits> 행사 배너"
---

## 제출 한 시간 전

Google 계정 선택 화면까지는 멀쩡하게 떴다. 계정을 고르고 동의까지 눌렀는데, 거기서 앱이 멈췄다. Chrome Custom Tab에 인증 완료 화면만 덩그러니 남고, 우리 앱으로는 돌아오지 않았다. 뒤로 가기를 눌러도 그대로. 제출까지 남은 시간은 한 시간 남짓이었다.

이게 2026 MESH 해커톤에서 내가 가장 오래 붙잡고 있던 30분의 시작이다. 결론부터 말하면, 우리 팀은 결국 제출했고 **3등(상금 10만 원)**을 받았다.

![2026 MESH Hackathon 3등 수상](../images/mesh-hackathon-award.jpg)

## 어떤 해커톤이었나

2026.06.27(토)–06.28(일), 중앙대학교에서 열린 **2026 MESH \<The Limits\> Hackathon × AWS**. 슬로건이 "완벽하지 않아도 괜찮아요, 일단 부딪혀 봐요"였는데, 1박 2일 일정을 겪고 나니 이보다 정확한 표현이 없었다.

우리 팀은 7명이었다. PM 1명, 백엔드 3명, 프론트엔드 3명. 만든 건 **VoDa** — 봉사 활동을 쉽고 빠르게 찾아주는 AI 기반 봉사 매칭 Android 앱이다.

- **기술 스택**: Kotlin, Jetpack Compose + Material3, MVVM + Clean Architecture, Hilt(DI), Navigation Compose, Retrofit2 + OkHttp3, Coil
- **화면 구성**: 온보딩 → 로그인 → 홈 / 검색 / 찜 / 내 활동 / 마이페이지 (바텀 네비게이션)
- **협업**: `main`(배포) ← `dev`(통합) ← `feature/*` 브랜치. 프론트 3명이 온보딩·로그인 / 홈·검색 / 찜·활동으로 화면을 나눠 맡고, PR 리뷰 후 머지했다.

솔직히 일정은 내내 빠듯했다. 백엔드 작업이 예상보다 훨씬 오래 걸렸고, API가 어느 정도 준비돼서 프론트와 실제로 연결을 시작할 수 있게 됐을 땐 이미 제출까지 한 시간밖에 남지 않은 상태였다. 밤새 카페인을 너무 부어 넣은 탓에 속은 계속 안 좋았고, 그 컨디션으로 마지막 연결 작업을 몰아쳤다.

## 내가 맡은 것 — 로그인 플로우를 통째로 갈아엎기

사실 로그인은 이번 해커톤에서 내가 손댄 마지막 조각이었다. 그전까지는 **홈·검색·지도 화면**을 만들고 있었다 — 봉사 활동 목록을 띄우는 홈, 조건으로 걸러 찾는 검색, 활동 위치를 지도 위에 보여주는 화면. 백엔드 연결이 제출 한 시간 전에야 가능해지면서, 그때 Mock 상태로 남아 있던 로그인을 실제 **Google 소셜 로그인**으로 갈아끼우는 작업에 손을 댔다.

기존 코드에는 이메일/비밀번호 기반의 Mock 로그인 폼이 있었다. 내 일은 이걸 실제로 동작하는 Google 소셜 로그인으로 바꾸고 백엔드 인증 API에 붙이는 것이었다.

### 왜 Credential Manager였나

Android에서 Google 로그인을 붙이는 방법은 두 갈래다. 예전부터 쓰이던 `GoogleSignInClient`와, 최신 `androidx.credentials`(Credential Manager). 나는 후자를 골랐고, 이유는 세 가지가 맞물렸다.

- 레거시 `GoogleSignInClient`는 이미 deprecated라, 새로 짜는 마당에 굳이 지는 쪽에 걸 이유가 없었다.
- One Tap UX — 기기에 이미 로그인된 계정을 원탭으로 보여주는 흐름을 처음부터 1차 진입점으로 두고 싶었다.
- 앞으로의 방향성도 Credential Manager 쪽이 정답이었다.

### 2단계 로그인 전략

그래서 로그인을 두 단계로 설계했다. 1차는 기기에 저장된 계정을 원탭으로 띄우고, 실패하면 2차로 새 계정도 추가할 수 있는 전체 로그인 UI로 폴백하는 구조다.

```kotlin
// 1차: 기기에 저장된 계정을 One Tap으로
val googleIdOption = GetGoogleIdOption.Builder()
    .setServerClientId(webClientId)
    .setFilterByAuthorizedAccounts(false)
    .build()

try {
    val result = credentialManager.getCredential(context, request(googleIdOption))
    return extractIdToken(result)
} catch (e: GetCredentialCancellationException) {
    // 사용자가 직접 취소한 경우엔 여기서 끝. 2차 시도하지 않음.
    throw e
} catch (e: GetCredentialException) {
    // 그 외 실패 → 2차 폴백으로
}

// 2차: 새 계정 추가까지 가능한 전체 로그인 UI
val signInOption = GetSignInWithGoogleOption.Builder(webClientId).build()
val result = credentialManager.getCredential(context, request(signInOption))
return extractIdToken(result)
```

여기서 한 가지 신경 쓴 건 **취소와 실패를 구분한 것**이다. 사용자가 계정 선택 창에서 직접 "취소"를 누른 경우(`GetCredentialCancellationException`)까지 2차 폴백으로 넘겨버리면, 취소했는데 로그인 창이 또 뜨는 짜증나는 UX가 된다. 그래서 이 예외만은 폴백하지 않고 바로 종료시켰다.

### 그리고, 앱으로 돌아오지 않던 30분

2단계 폴백까지 다 짜고 돌려봤는데, 바로 그 증상이 나왔다. 계정 선택·동의 화면까지는 뜨는데 인증이 끝나면 앱으로 복귀하지 못하고 Chrome Custom Tab에서 멈춰버리는.

원인을 좁혀보니 이랬다. Credential Manager 로그인이 웹 플로우로 폴백되면 Chrome Custom Tab이 열리고, 인증이 끝난 뒤 `com.googleusercontent.apps.518317720365-...`라는 커스텀 scheme으로 앱에 리다이렉트를 보낸다. 그런데 **그 리다이렉트를 받아줄 intent-filter가 앱에 없었다.** 돌아올 문을 안 만들어 둔 셈이라, 인증은 성공해도 그 결과가 앱으로 들어올 경로 자체가 없었다.

해결은 `AndroidManifest.xml`의 `MainActivity`에 그 scheme을 받는 intent-filter를 추가하는 것이었다.

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.googleusercontent.apps.518317720365-..." />
</intent-filter>
```

여기에 `MainActivity`의 `launchMode`를 `singleTop`으로 걸었다. 리다이렉트로 돌아올 때 액티비티가 새로 하나 더 뜨는 게 아니라, 이미 떠 있는 기존 인스턴스로 복귀하게 하기 위해서다.

이걸 붙잡고 있던 게 하필 제출까지 한 시간도 안 남은 시점이었고, 원인을 찾아 고치기까지 30분 넘게 걸렸다. 인증 로직 자체는 멀쩡했는데 "돌아올 문"이 없다는 걸 깨닫기까지가 오래 걸렸다. 로그인이 마침내 앱으로 툭 돌아왔을 때의 안도감은 아직도 기억난다.

### 백엔드와 병행하며 어긋난 것들

프론트와 백엔드가 동시에 달리는 해커톤에선 스펙이 발밑에서 흔들린다.

- `AuthRepository.loginWithGoogle(idToken)`이 백엔드 `/social-login`에 idToken을 넘기면 JWT를 발급받아 DataStore에 저장하고, 응답의 `isNewUser` 플래그로 신규 유저는 온보딩, 기존 유저는 홈으로 분기하도록 짰다.
- 그런데 어느 순간 앱이 갑자기 안 돌아갔다. 원인을 파보니 백엔드 응답 필드명이 `accessToken`에서 `token`으로 바뀌어 있었다. DTO(`SocialLoginData`)를 다시 맞춰서 해결했는데, "앱이 죽는다 → 알고 보니 스펙이 바뀌어 있었다"는 이 흐름이 해커톤 내내 반복됐다.
- API 서버 주소도 중간에 Railway에서 Render로 옮겨야 했다.

### 해커톤용 임시 기능, 안전하게 숨기기

로그인이 실제 Google 인증에 물려 있으면, 다른 화면을 작업하는 팀원들이 테스트할 때마다 매번 로그인을 다시 타야 한다. 빠듯한 일정에 이건 낭비다. 그래서 `BuildConfig.DEBUG`일 때만 노출되는 "토큰 직접 입력" 다이얼로그(`saveDevToken`)를 만들었다. Swagger에서 발급받은 JWT를 붙여넣으면 실제 로그인 없이 바로 홈으로 진입할 수 있다.

핵심은 이걸 **`BuildConfig.DEBUG` 가드 뒤에 숨긴 것**이다. 릴리스 빌드에선 아예 존재하지 않는 코드가 되니까, 편의 기능이 프로덕션에 새어 나갈 걱정이 없다. 해커톤 특유의 "일단 빠르게" 정신과 최소한의 안전장치를 타협한 지점이었다.

## 설정 변경 메모

- `build.gradle.kts`: `buildConfig = true` 활성화, Credential Manager 의존성 3종(`androidx-credentials`, `androidx-credentials-play-services`, `google-identity-googleid`) 추가
- `AndroidManifest.xml`: 위의 커스텀 scheme intent-filter 추가 + `MainActivity`에 `launchMode="singleTop"`
- `LoginScreen`/`ViewModel`: 이메일/비밀번호 상태·유효성 검사 로직을 전부 걷어내고 Google 로그인 단일 플로우로 단순화. 로딩 중 `CircularProgressIndicator`, 에러 메시지 UI 추가

## 마무리

1박 2일 안에 로그인 플로우를 통째로 새 방식으로 갈아엎는 건 부담스러운 선택이었다. 그것도 백엔드 연결이 제출 한 시간 전에야 시작된, 최악의 타이밍에서. 하지만 인증이라는 앱의 입구를 안정적으로 세워두니, 나머지 화면 작업자들이 그 위에서 각자 몫에 집중할 수 있었다.

돌아보면 배운 건 기술 하나하나보다, "돌아올 문을 만들어 두는 것"에 대한 감각이었다. OAuth 리다이렉트든 병행 개발이든, 성공 경로만 짜두면 반은 안 되는 거였다. "완벽하지 않아도 괜찮으니 일단 부딪혀 보라"던 슬로건처럼, 끝까지 동작하는 걸 먼저 만든 게 결국 3등으로 이어졌다고 생각한다.
