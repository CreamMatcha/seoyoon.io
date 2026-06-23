---
title: "기술 블로그를 만들기까지: 지금까지의 개발 기록"

description: "Astro와 Cloudflare Workers로 블로그를 세팅하고, CI/CD를 구축하고, 템플릿을 내 브랜드로 바꾸기까지의 과정을 기록합니다."

author: "Seoyoon"
pubDate: 2026-06-23
isDraft: false

image: "@blogImages/image-1.png"
imageAlt: "추상적인 그라데이션 이미지 (임시 표지 이미지)"
---

## 왜 블로그를 만들었나

개발하면서 AI와 협업한 과정, 그리고 그 과정에서 배운 것들을 기록해두고 싶었다. 머릿속에만 있던 것들은 금방 사라지니까, 이번엔 직접 블로그를 만들어서 남기기로 했다.

## 1. Astro + Cloudflare Workers로 뼈대 세우기

블로그는 Astro로 시작했다. 마크다운 기반 콘텐츠 컬렉션을 그대로 쓸 수 있고, 정적 페이지와 서버 사이드 로직을 섞어 쓰기 편해서였다. 배포는 Cloudflare Workers를 선택했고, `@astrojs/cloudflare` 어댑터로 SSR을 붙였다.

로컬에서 Git/GitHub 연동과 Node.js 개발 환경을 먼저 정리한 다음, Cloudflare API 토큰과 계정 ID를 발급받아 GitHub Secrets에 등록했다. 토큰 이름에 오타가 있어서 한 번 다시 등록해야 했는데, 이런 작은 디테일이 항상 발목을 잡는다.

## 2. GitHub Actions로 자동 배포 파이프라인 구축

`.github/workflows/deploy.yml`에 `main` 브랜치 푸시를 트리거로 잡고, `cloudflare/wrangler-action`으로 배포하도록 구성했다. 처음 몇 번은 pnpm 버전이 맞지 않아 빌드가 깨졌는데, `packageManager` 필드로 버전을 고정하고서야 통과했다.

지금은 `main`에 푸시할 때마다 자동으로 빌드되고 `*.workers.dev` 주소로 배포된다.

## 3. 템플릿 흔적 지우고 내 블로그로 만들기

처음엔 `astro-i18n-starter`라는 오픈소스 템플릿에서 시작했다. 다국어(i18n) 구조가 잘 짜여 있어서 골격은 그대로 가져왔지만, 기본값은 영어/슬로베니아어였고 홈/소개 페이지도 템플릿 자체를 설명하는 글로 가득했다.

그래서 다음을 정리했다:

-   언어를 영어/슬로베니아어에서 영어/한국어로 바꾸고, URL은 `/ko/about`처럼 영어 슬러그를 그대로 썼다.
-   홈, 소개, 페이지의 템플릿 소개글을 짧은 자리표시자로 바꿨다.
-   Header/Footer의 GitHub 링크, 사이트 타이틀, manifest, `package.json` 메타데이터를 전부 내 이름("Seoyoon")으로 정리했다.

## 다음 할 일

이제 뼈대와 브랜딩은 끝났다. 다음은 진짜 콘텐츠다 — 템플릿이 채워둔 샘플 글들을 지우고, 이렇게 직접 쓰는 개발 기록부터 하나씩 쌓아갈 계획이다.
