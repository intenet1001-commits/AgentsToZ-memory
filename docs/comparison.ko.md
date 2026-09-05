# 비교 근거 노트

확인일: 2026-09-05–06. 방법: 공식 기술 문서·공식 저장소·학술 논문 확인. 경쟁 서비스 계정으로 직접 성능·과금 실험을 한 결과는 아니다. 에세이는 설계자 관점이며, 이 표도 독립 벤치마크가 아니다.

## 확인한 내용

| 대상 | 문서에서 확인한 구조 | 단정해서는 안 되는 내용 |
|---|---|---|
| Hermes 기본 기억 | 로컬 `MEMORY.md`·`USER.md`, 프로필 범위, 세션 시작 시 스냅샷 주입, 별도 SQLite 세션 검색. [공식 문서](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/) | 기본 기억과 외부 제공자의 저장 정책은 같지 않다. |
| Hindsight | 자체 호스팅/클라우드, memory bank, retain/recall/reflect, 코딩 에이전트 통합의 per-repo bank. [공식 README 고정본](https://github.com/vectorize-io/hindsight/blob/eb32332e26fc9d3d827632a8e48ae405a78f9801/README.md) | 프로젝트 기억이 없다고 할 수 없다. 전용 코딩 통합과 Hermes의 기본 bank 설정은 별개다. |
| Mem0 | OSS 라이브러리/자체 호스팅 서버와 관리형 플랫폼. [OSS 문서](https://docs.mem0.ai/open-source/overview). API는 `user_id`·`agent_id`·`app_id`·`run_id` 범위를 지원한다. [API 문서](https://docs.mem0.ai/api-reference/memory/add-memories) | 이 식별자가 코드 저장소를 자동 감지한다는 뜻은 아니다. API 버전과 호스트 통합을 확인해야 한다. |
| Honcho | workspace 아래 peer·session, 세션 범위를 통한 회상 제한, peer 중심의 세션 간 추론. [아키텍처](https://honcho.dev/docs/v3/documentation/core-concepts/architecture). [자체 호스팅 안내](https://honcho.dev/docs/v3/contributing/self-hosting)도 있다. | peer 중심 설계와 프로젝트별 분리는 양립할 수 있다. |
| AgentsToZ Memory 0.1.0 | 명시적인 로컬 프로젝트 root, 정제 Markdown, 안정 ID·본문 해시, 어휘 회상, CAS 저장, 보존형 업그레이드. [SDK 소스](../src/memory.ts), [추출한 회상 코드](../src/core/projectMemoryRecall.ts) | 앱 전체의 동기화·journal 검색·자동 체크포인트가 SDK에 포함된 것은 아니다. 테스트 통과는 기억 정확도 우위의 증거가 아니다. |

Hermes 공식 provider 문서는 Honcho의 `sessionStrategy`에 `per-directory`·`per-repo` 등을, Hindsight에는 `bank_id`를, Mem0에는 사용자·에이전트 ID 설정을 명시한다. 따라서 **백엔드가 지원하는 범위, 플러그인의 기본값, 사용자가 적용한 설정**을 따로 비교해야 한다. 화면의 메뉴만으로 데이터 격리·보관·청구 방식을 알 수 없다. [Hermes Memory Providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers)

화면에 함께 나온 Byterover·Holographic·OpenViking·RetainDB·Supermemory까지 포함한 전체 시장 순위나 가격표를 작성한 것은 아니다. 여기서는 핵심 가설을 검토할 수 있는 대표 비교 대상으로 Hermes 기본 기억과 Hindsight·Mem0·Honcho를 선택했다. 남은 제공자에 대해서는 구독 여부·격리·성능을 추정하지 않는다.

## 비용과 데이터 흐름

자체 호스팅 가능 여부와 총비용은 다르다. 서버, 추론 모델, 임베딩, 유지보수에 비용이 생길 수 있다. Honcho의 자체 호스팅 문서도 데이터베이스와 모델 구성을 요구한다. 가격 숫자는 변경 가능성이 크고 이 비교의 핵심이 아니므로 제시하지 않는다. [Honcho 자체 호스팅](https://honcho.dev/docs/v3/contributing/self-hosting)

SDK 자체는 네트워크를 호출하지 않지만, 사용자가 주입하는 모델 어댑터는 세션 문맥과 기존 기억을 받는다. 따라서 “로컬 저장”을 “아무 정보도 외부로 나가지 않음”과 동일시하지 않는다. 세션 원문을 파일로 별도 저장하지 않는 것과 정제 결과에 민감한 정보가 전혀 남지 않는 것도 다르다. [보안 경계](security.md)

## 앞으로 검증할 가설

프로젝트 경계를 명시하고 수정 이력을 남기는 설계가 장기 작업의 오류와 전환 비용을 줄이는지는 실험으로 확인해야 한다. 같은 기초 모델·질문·기억 입력·토큰 예산을 사용하고, 외부 검색 허용 범위를 고정한 뒤 다음을 측정한다.

- 회상·최종 답변 정확도와 근거 없는 응답의 비율
- 새 사실 반영, 오래된 사실 철회, 날짜가 다른 사실의 구분
- 별도 프로젝트에만 존재하는 사실이 다른 프로젝트 답변에 섞이는 비율
- 저장·회상 지연, 토큰·모델·인프라 비용
- 삭제 후 현재 회상, 과거 이력, 백업과 공급자 보관소 각각에 남은 데이터

LongMemEval은 정보 추출, 다중 세션 추론, 시간 추론, 지식 갱신, 답변 유보를 구분하는 평가 틀을 제공한다. 해당 평가를 아직 이 SDK에서 수행하지 않았다. 기능 테스트 수를 이 벤치마크 점수로 바꾸어 해석하지 않는다. [Wu et al., LongMemEval, ICLR 2025](https://arxiv.org/abs/2410.10813v2)

## 재현성과 출처

Hindsight 인용은 확인한 README의 커밋에 고정했다. 나머지 문서 URL은 갱신될 수 있으므로 확인일을 함께 기록한다. 자체 코드의 추출 버전과 파일 해시는 [PROVENANCE.json](../PROVENANCE.json)에 있다. 외부 문서에 있는 마케팅식 우위 주장·벤치마크 수치를 재검증 없이 옮기지 않았으며, 독자의 개별 설정이나 결제 상태도 추정하지 않았다.
