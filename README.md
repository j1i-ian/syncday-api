# ![Syncday Logo](https://dev.sync.day/assets/images/logo/logo.svg) Syncday Backend API App

## ℹ️ Introduction to Syncday

Syncday 는 B2B SaaS Platform 으로서 booking 기능을 기반한 time scheduling 서비스입니다.

경쟁사로는 [Calendly](calendly.com) 가 있습니다.

## 🗺 구조 및 설계

최종적인 소프트웨어 아키텍처 지향점은 아래와 같습니다.

- DTO / VO - CoR - MVC - Strategy - Singleton - Criteria - Composite / Builder / CQRS - Repository / Facade

## 🗜 Pipelines

현재 [Gitlab CI](https://about.gitlab.com/free-trial/devsecops/?utm_medium=cpc&utm_source=google&utm_campaign=brand_apac_pr_rsa_br_exact_free-trial_&utm_content=free-trial&_bt=654332970169&_bk=gitlab%20ci%20cd&_bm=e&_bn=g&_bg=142303747835&gclid=Cj0KCQjwz8emBhDrARIsANNJjS7sbINPueqDyEfPJv2iXA02UQiQw_bJqGKmEE5ykEVPO1Kl4iTBZzUaAtvCEALw_wcB) 를 사용 중입니다.

Cloud Platform 은 AWS 이므로 연계해서 쓸 일이 자주 있습니다.

SAST 기법이 현재 적용된 상태로 DevSecOps Pipeline 이라고 할 수 있습니다.

관련 작업을 한다면 [Gitlab CI/CD](https://docs.gitlab.com/ee/ci/introduction/) 와 `.gitlab-ci.yml` 을 참고하세요.

## 🕋 개발 환경 구축

### 로컬 개발환경 구축

Syncday Project 는 Local 에서조차 Google Integration 을 테스트할 수 있을만큼 굉장히 잘 구성되어있습니다.

필요한 툴들은 아래와 같습니다.

- ngrok
- openVPN
    - client, profile 구성이 필요.
- docker
- node, npm
- .env.local 구성

현재는 Redis Cluster 에 대한 Dockerizing 구성이 덜 되어있어 local 개발환경이 반쯤은 불가한 상황입니다.

> 💡 서버를 띄우는 것 자체가 목적이라면 OpenVPN Client Profile 을 발급받아 Client 를 구성한 후 Dev 환경에 붙어보도록 해봅시다.

#### Local Integration 환경 구축

Google Integration 을 예로 들어 봅시다. Google 과 서비스를 연동하면 Google Calendar 에 event 를 생성할 때 이 event 를 우리 서비스의 schedule 로 변환하도록 하는 기능이 있습니다.

하지만 schedule 로 변환하려고 하면 Google Calendar Event 의 body 를 알아야하고 문서에 나와있거나 나와있지 않은 raw data 에 대해 어떻게 처리할 것인지 직면해야 작업하기 수월합니다.

근데 Google 은 외부 Domain 인데 local 에서 띄울 수 있을까요? 쉽지 않지만 우리 프로젝트에서는 쉽게 만들어놨습니다.

우선 ngrok 을 통해 https 임시 도메인을 발급받습니다.

`ngrok http 3011` (3011 = api app default port)

`.env.local` (혹은 `.env.dev`) 의 HOST key 에 대한 value 에 발급된 https 주소를 넣어줍시다.

아래와 같은 URL 을 통해 Google Sign In 을 해줍시다.

`http://localhost:3011/v1/tokens/google?integrationContext=integrate&email=MyTestEmail@sync.day`

참고로 Google OAuth 등록한 곳을 기준으로 notification webhook 이 오기 때문에 local 로 등록이 되었을 경우 dev 에서 다시 재연동해줘야합니다.

#### 💿 Local DB 세팅

`docker compose up mariadb -d` 로 DB 만 실행할 수 있습니다.

#### 🔐 VPN - OpenVPN

OpenVPN 을 사용하여 private subnet 자원들에 쉽게 접근할 수 있습니다. 세팅 방법에 대한 문서화가 필요합니다.

## 📂 운영

### Elasticache cluster 접속하기

### Database: MariaDB

#### 데이터 조회 계정

readonly 계정이 있습니다. DBConnector 에 따라서 예상치 못한 작동으로 인해 사고가 날 수 있으므로

이를 방지하기 위해 가급적이면 readonly 계정을 씁시다.

#### 설정 현황

현재는 단독 DB 서버입니다. 나중에 traffic 이 커진다면 active-standby 구조로 갈 지도?

#### Parameters

| Parameter                | Current Value      |
|--------------------------|--------------------|
| character_set_client     | utf8mb4            |
| character_set_connection | utf8mb4            |
| character_set_database   | utf8mb4            |
| character_set_filesystem | binary             |
| character_set_results    | utf8mb4            |
| character_set_server     | utf8mb4            |
| collation_connection     | utf8mb4_unicode_ci |
| collation_server         | utf8mb4_unicode_ci |

### 🚀 내부 Gitalb runner 서버에 대해서

[관련 노션 링크](https://www.notion.so/syncday/Runner-server-DDNS-port-forwarding-70e5be7dcb4141bc9fac3db51fd7a465?pvs=4)

### ✍️ Sign up process

Sign up follows next steps with api call:

- Email User
    - Create temp user
    - Create verification
    - Create user with email verification
- OAuth User
    - Sign in with OAuth
    - OAuth Callback with redirection

## Etc

### Custom ESLint rules

* `no-shadow`: bug
* `no-underscore-dangle`: for private member convention
* `@typescript-eslint/indent`, `indent`: conflicts with prettier indent
* `@typescript-eslint/no-explicit-any`, casting private method as any for stubbing
* `@typescript-eslint/no-unsafe-call`, no unsafe call option is disabled for testing

### tsconfig

* disabled `strictPropertyInitialization` option is for entity definition

[namecheap]: https://www.namecheap.com/
